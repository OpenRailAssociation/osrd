package fr.sncf.osrd.api.stdcm

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.Range
import com.google.common.collect.TreeRangeSet
import fr.sncf.osrd.api.*
import fr.sncf.osrd.api.pathfinding.findWaypointBlocks
import fr.sncf.osrd.api.pathfinding.hasDuplicateTracks
import fr.sncf.osrd.api.pathfinding.runPathfindingBlockPostProcessing
import fr.sncf.osrd.api.standalone_sim.*
import fr.sncf.osrd.conflicts.ParsedRequirements
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue.Percentage
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue.TimePerDistance
import fr.sncf.osrd.envelope_sim_infra.computeMRSP
import fr.sncf.osrd.pathfinding.Pathfinding
import fr.sncf.osrd.pathfinding.Pathfinding.EdgeLocation
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.signaling.etcs_level2.ETCS_LEVEL2
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.DirTrackChunkId
import fr.sncf.osrd.sim_infra.api.SpeedLimitProperty
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.sim_infra.impl.TemporarySpeedLimitManager
import fr.sncf.osrd.standalone_sim.makeElectricalProfiles
import fr.sncf.osrd.standalone_sim.makeMRSPResponse
import fr.sncf.osrd.standalone_sim.result.ElectrificationRange
import fr.sncf.osrd.standalone_sim.runScheduleMetadataExtractor
import fr.sncf.osrd.stdcm.PlannedTimingData
import fr.sncf.osrd.stdcm.STDCMResult
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.stdcm.graph.checkPlannedStepsAndMaybeIndex
import fr.sncf.osrd.stdcm.graph.findPath
import fr.sncf.osrd.stdcm.graph.logger
import fr.sncf.osrd.stdcm.preprocessing.implementation.makeBlockAvailability
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.DistanceRangeMap.RangeMapEntry
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.units.*
import io.opentelemetry.api.trace.Span
import io.opentelemetry.api.trace.SpanKind
import io.opentelemetry.instrumentation.annotations.WithSpan
import java.io.File
import java.time.Duration.between
import java.time.Duration.ofMillis
import java.time.LocalDateTime
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.TreeMap
import kotlinx.coroutines.runBlocking
import org.takes.Request
import org.takes.Response
import org.takes.Take
import org.takes.rq.RqPrint
import org.takes.rs.RsJson
import org.takes.rs.RsText
import org.takes.rs.RsWithBody
import org.takes.rs.RsWithStatus

class STDCMEndpoint(
    private val infraManager: InfraProvider,
    private val timetableCacheManager: TimetableCacheManager,
) : Take {
    @Throws(OSRDError::class)
    override fun act(req: Request): Response {
        // Parse request input
        val request = readRequest(req) ?: return RsWithStatus(RsText("missing request body"), 400)

        val logRequest = System.getenv("LOG_STDCM_REQUESTS")
        if (logRequest?.equals("true", ignoreCase = true) == true) {
            val time = LocalDateTime.now()
            val formatted = time.format(DateTimeFormatter.ofPattern("MM-dd-HH:mm:ss:SSS"))
            val filename = "stdcm-$formatted.json"
            Span.current()?.setAttribute("request-file", filename)
            File(filename).printWriter().use {
                it.println(stdcmRequestAdapter.indent("    ").toJson(request))
            }
        }

        return run(request)
    }

    @WithSpan(value = "Reading request content", kind = SpanKind.SERVER)
    private fun readRequest(req: Request): STDCMRequest? {
        val body = RqPrint(req).printBody()
        return stdcmRequestAdapter.fromJson(body)
    }

    /** Process the given parsed request */
    @WithSpan(value = "Processing STDCM request", kind = SpanKind.SERVER)
    fun run(request: STDCMRequest): Response {
        logger.info(
            "Request received: start=${request.startTime}, max duration=${request.maximumRunTime}"
        )
        return try {
            // parse input data
            val infra = infraManager.getInfra(request.infra, request.expectedVersion)
            val temporarySpeedLimitManager =
                buildTemporarySpeedLimitManager(infra, request.temporarySpeedLimits)
            val rollingStock =
                parseRawRollingStock(
                    request.physicsConsist,
                    request.rollingStockLoadingGauge,
                    request.rollingStockSupportedSignalingSystems.filter {
                        // Ignoring ETCS as it is not (yet) supported for STDCM
                        it != ETCS_LEVEL2.id
                    },
                )
            val steps = parseSteps(infra, request.pathItems, request.startTime)
            val requirements = getRequirements(request, infra)

            // Run the STDCM pathfinding
            val path =
                findPath(
                    infra,
                    rollingStock,
                    request.comfort,
                    0.0,
                    steps,
                    makeBlockAvailability(
                        requirements,
                        gridMarginBeforeTrain = request.timeGapBefore.seconds,
                        gridMarginAfterTrain = request.timeGapAfter.seconds,
                        timeStep = request.timeStep!!.seconds,
                    ),
                    request.timeStep.seconds,
                    request.maximumDepartureDelay!!.seconds,
                    request.maximumRunTime.seconds,
                    request.speedLimitTag,
                    parseMarginValue(request.margin),
                    Pathfinding.TIMEOUT,
                    temporarySpeedLimitManager,
                )
            if (path == null || hasDuplicateTracks(infra, path.trainPath)) {
                val response = PathNotFound()
                return RsJson(RsWithBody(stdcmResponseAdapter.toJson(response)))
            }
            val pathfindingResponse =
                runPathfindingBlockPostProcessing(infra, path.trainPath, path.waypointOffsets)

            val simulationResponse =
                buildSimResponse(
                    infra,
                    path,
                    rollingStock,
                    request.speedLimitTag,
                    temporarySpeedLimitManager,
                    request.comfort,
                )

            val departureTime =
                request.startTime.plus(ofMillis((path.departureTime * 1000).toLong()))
            val response = STDCMSuccess(simulationResponse, pathfindingResponse, departureTime)
            RsJson(RsWithBody(stdcmResponseAdapter.toJson(response)))
        } catch (ex: Throwable) {
            ExceptionHandler.handle(ex)
        }
    }

    /**
     * Collect all spacing requirements in an easily fetchable format. Combines both train
     * requirements and work schedules.
     */
    private fun getRequirements(request: STDCMRequest, infra: FullInfra): ParsedRequirements {
        val res = mutableMapOf<ZoneId, TreeRangeSet<Double>>()
        convertWorkScheduleCollection(infra.rawInfra, request.workSchedules)
            .spacingRequirements
            .forEach { spacingReq ->
                val set = res.computeIfAbsent(spacingReq.zone) { TreeRangeSet.create() }
                set.add(Range.closedOpen(spacingReq.beginTime, spacingReq.endTime))
            }

        val trainRequirements = runBlocking {
            timetableCacheManager.get(request.infra, infra.rawInfra, request.timetableId)
        }
        // Cached requirements are relative to EPOCH. Add time diff with request start time
        // to these requirements.
        val searchWindowBeginEpoch = request.startTime.durationSinceEpoch()
        val searchWindowEndEpoch =
            searchWindowBeginEpoch +
                request.maximumDepartureDelay!!.seconds +
                request.maximumRunTime.seconds
        for ((zoneId, rangeSet) in trainRequirements) {
            val setBuilder = res.computeIfAbsent(zoneId) { TreeRangeSet.create() }
            for (range in rangeSet.asRanges()) {
                // Filter out unnecessary requirements
                val included =
                    range.upperEndpoint() > searchWindowBeginEpoch &&
                        range.lowerEndpoint() < searchWindowEndEpoch
                if (included) {
                    val newRange =
                        Range.range(
                            range.lowerEndpoint() - searchWindowBeginEpoch,
                            range.lowerBoundType(),
                            range.upperEndpoint() - searchWindowBeginEpoch,
                            range.upperBoundType(),
                        )
                    setBuilder.add(newRange)
                }
            }
        }
        return res.mapValues { rangeSet ->
            TreeMap(rangeSet.value.asRanges().associateBy { it.upperEndpoint() })
        }
    }

    /** Build the simulation part of the response */
    private fun buildSimResponse(
        infra: FullInfra,
        path: STDCMResult,
        rollingStock: RollingStock,
        speedLimitTag: String?,
        temporarySpeedLimitManager: TemporarySpeedLimitManager?,
        comfort: Comfort,
    ): SimulationSuccess {
        val scheduleItems = parseSimulationScheduleItems(path.stopResults).toMutableList()
        // Add a short stop at the end to avoid signal propagation
        scheduleItems.add(
            SimulationScheduleItem(
                Offset(path.trainPath.getLength()),
                null,
                0.1.seconds,
                RJSTrainStop.RJSReceptionSignal.STOP,
            )
        )
        val reportTrain =
            runScheduleMetadataExtractor(
                path.envelope,
                path.trainPath,
                infra,
                rollingStock,
                scheduleItems,
                listOf(),
            )

        // Lighter description of the same simulation result
        val simpleReportTrain =
            ReportTrain(
                reportTrain.positions,
                reportTrain.times,
                reportTrain.speeds,
                reportTrain.energyConsumption,
                reportTrain.pathItemTimes,
            )
        val speedLimits =
            computeMRSP(
                path.trainPath,
                rollingStock,
                false,
                speedLimitTag,
                temporarySpeedLimitManager,
            )

        // All simulations are the same for now
        return SimulationSuccess(
            base = simpleReportTrain,
            provisional = simpleReportTrain,
            finalOutput = reportTrain,
            mrsp = makeMRSPResponse(speedLimits),
            electricalProfiles = buildSTDCMElectricalProfiles(path, rollingStock, comfort),
        )
    }

    /** Build the electrical profiles from the path */
    private fun buildSTDCMElectricalProfiles(
        path: STDCMResult,
        rollingStock: RollingStock,
        comfort: Comfort,
    ): RangeValues<ElectricalProfileValue> {
        val electrificationMap =
            path.trainPath.getElectrificationMap(
                rollingStock.basePowerClass,
                ImmutableRangeMap.of(),
                rollingStock.powerRestrictions,
                false,
            )
        val curvesAndConditions = rollingStock.mapTractiveEffortCurves(electrificationMap, comfort)
        val electrificationRanges =
            ElectrificationRange.from(curvesAndConditions.conditions, electrificationMap)
        return makeElectricalProfiles(electrificationRanges)
    }
}

@WithSpan(value = "Parsing speed limits", kind = SpanKind.SERVER)
fun buildTemporarySpeedLimitManager(
    infra: FullInfra,
    speedLimits: Collection<STDCMTemporarySpeedLimit>,
): TemporarySpeedLimitManager {
    val outputSpeedLimits: MutableMap<DirTrackChunkId, DistanceRangeMap<SpeedLimitProperty>> =
        mutableMapOf()
    for (speedLimit in speedLimits) {
        for (trackRange in speedLimit.trackRanges) {
            val trackSection =
                infra.rawInfra.getTrackSectionFromName(trackRange.trackSection) ?: continue
            val trackChunks = infra.rawInfra.getTrackSectionChunks(trackSection)
            for (trackChunkId in trackChunks) {
                val trackChunkLength = infra.rawInfra.getTrackChunkLength(trackChunkId).distance
                val chunkStartOffset = infra.rawInfra.getTrackChunkOffset(trackChunkId)
                val chunkEndOffset = chunkStartOffset + trackChunkLength
                if (chunkEndOffset < trackRange.begin || trackRange.end < chunkStartOffset) {
                    continue
                }
                val startOffset = Distance.max(0.meters, trackRange.begin - chunkStartOffset)
                val endOffset = Distance.min(trackChunkLength, trackRange.end - chunkStartOffset)
                val direction =
                    when (trackRange.direction) {
                        EdgeDirection.START_TO_STOP -> Direction.INCREASING
                        EdgeDirection.STOP_TO_START -> Direction.DECREASING
                    }
                val dirTrackChunkId = DirTrackChunkId(trackChunkId, direction)
                val chunkSpeedLimitRangeMap =
                    distanceRangeMapOf(
                        RangeMapEntry(
                            startOffset,
                            endOffset,
                            SpeedLimitProperty(
                                Speed.fromMetersPerSecond(speedLimit.speedLimit),
                                null,
                            ),
                        )
                    )
                if (outputSpeedLimits.contains(dirTrackChunkId)) {
                    outputSpeedLimits[dirTrackChunkId]!!.updateMap(
                        chunkSpeedLimitRangeMap,
                        { s1, s2 ->
                            if (s1.speed < s2.speed) {
                                s1
                            } else {
                                s2
                            }
                        },
                    )
                } else {
                    outputSpeedLimits[dirTrackChunkId] = chunkSpeedLimitRangeMap
                }
            }
        }
    }
    return TemporarySpeedLimitManager(outputSpeedLimits)
}

private fun parseSteps(
    infra: FullInfra,
    pathItems: List<STDCMPathItem>,
    startTime: ZonedDateTime,
): List<STDCMStep> {
    if (pathItems.last().stopDuration == null) {
        throw OSRDError(ErrorType.MissingLastSTDCMStop)
    }
    if (pathItems.any { it.stopDuration == null && it.stepTimingData != null }) {
        throw OSRDError(ErrorType.InvalidSTDCMStepWithTimingData)
    }

    val (valid, _) = checkPlannedStepsAndMaybeIndex(pathItems.map { it.stepTimingData })
    if (!valid) {
        throw OSRDError(ErrorType.InvalidSTDCMStepWithTimingData)
    }

    // Semantically a stop at the start location doesn't change anything,
    // it's not *wrong* so there's no error, but it's easier to consider
    // that it's not a stop.
    pathItems.first().stopDuration = null

    return pathItems.map {
        STDCMStep(
            findWaypointBlocks(infra, it.locations),
            it.stopDuration?.seconds,
            it.stopDuration != null,
            if (it.stepTimingData != null)
                PlannedTimingData(
                    TimeDelta(between(startTime, it.stepTimingData.arrivalTime).toMillis()),
                    it.stepTimingData.arrivalTimeToleranceBefore,
                    it.stepTimingData.arrivalTimeToleranceAfter,
                )
            else null,
        )
    }
}

private fun parseMarginValue(margin: MarginValue): AllowanceValue? {
    return when (margin) {
        is MarginValue.MinPer100Km -> {
            TimePerDistance(margin.value)
        }
        is MarginValue.Percentage -> {
            Percentage(margin.percentage)
        }
        is MarginValue.None -> {
            null
        }
    }
}

private fun parseSimulationScheduleItems(
    trainStops: List<TrainStop>
): List<SimulationScheduleItem> {
    return parseRawSimulationScheduleItems(
        trainStops.map {
            val duration = if (it.duration > 0.0) it.duration.seconds else null
            SimulationScheduleItem(Offset(it.position.meters), null, duration, it.receptionSignal)
        }
    )
}

private fun findWaypointBlocks(
    infra: FullInfra,
    waypoints: Collection<TrackLocation>,
): Set<EdgeLocation<BlockId, Block>> {
    val waypointBlocks = HashSet<EdgeLocation<BlockId, Block>>()
    for (waypoint in waypoints) {
        for (direction in Direction.entries) {
            waypointBlocks.addAll(findWaypointBlocks(infra, waypoint, direction))
        }
    }
    return waypointBlocks
}
