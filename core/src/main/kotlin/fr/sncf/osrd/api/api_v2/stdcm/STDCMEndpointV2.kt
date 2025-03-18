package fr.sncf.osrd.api.api_v2.stdcm

import com.google.common.collect.ImmutableRangeMap
import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.InfraManager
import fr.sncf.osrd.api.api_v2.*
import fr.sncf.osrd.api.api_v2.pathfinding.findWaypointBlocks
import fr.sncf.osrd.api.api_v2.pathfinding.runPathfindingBlockPostProcessing
import fr.sncf.osrd.api.api_v2.standalone_sim.*
import fr.sncf.osrd.conflicts.*
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue.Percentage
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue.TimePerDistance
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.envelope_sim_infra.computeMRSP
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.DirTrackChunkId
import fr.sncf.osrd.sim_infra.api.SpeedLimitProperty
import fr.sncf.osrd.sim_infra.impl.TemporarySpeedLimitManager
import fr.sncf.osrd.standalone_sim.makeElectricalProfiles
import fr.sncf.osrd.standalone_sim.makeMRSPResponse
import fr.sncf.osrd.standalone_sim.result.ElectrificationRange
import fr.sncf.osrd.standalone_sim.runScheduleMetadataExtractor
import fr.sncf.osrd.stdcm.PlannedTimingData
import fr.sncf.osrd.stdcm.STDCMResult
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.stdcm.graph.findPath
import fr.sncf.osrd.stdcm.graph.logger
import fr.sncf.osrd.stdcm.preprocessing.implementation.makeBlockAvailability
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.DistanceRangeMap.RangeMapEntry
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.toIdxList
import fr.sncf.osrd.utils.units.*
import io.opentelemetry.api.trace.SpanKind
import io.opentelemetry.instrumentation.annotations.WithSpan
import java.io.File
import java.time.Duration.between
import java.time.Duration.ofMillis
import java.time.LocalDateTime
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import org.takes.Request
import org.takes.Response
import org.takes.Take
import org.takes.rq.RqPrint
import org.takes.rs.RsJson
import org.takes.rs.RsText
import org.takes.rs.RsWithBody
import org.takes.rs.RsWithStatus

class STDCMEndpointV2(private val infraManager: InfraManager) : Take {
    @Throws(OSRDError::class)
    override fun act(req: Request): Response {
        // Parse request input
        val request = readRequest(req) ?: return RsWithStatus(RsText("missing request body"), 400)

        val logRequest = System.getenv("LOG_STDCM_REQUESTS")
        if (logRequest?.equals("true", ignoreCase = true) == true) {
            val time = LocalDateTime.now()
            val formatted = time.format(DateTimeFormatter.ofPattern("MM-dd-HH:mm:ss:SSS"))
            File("stdcm-$formatted.json").printWriter().use {
                it.println(stdcmRequestAdapter.indent("    ").toJson(request))
            }
        }

        return run(request)
    }

    @WithSpan(value = "Reading request content", kind = SpanKind.SERVER)
    private fun readRequest(req: Request): STDCMRequestV2? {
        val body = RqPrint(req).printBody()
        return stdcmRequestAdapter.fromJson(body)
    }

    /** Process the given parsed request */
    @WithSpan(value = "Processing STDCM request", kind = SpanKind.SERVER)
    fun run(request: STDCMRequestV2): Response {
        val recorder = DiagnosticRecorderImpl(false)
        logger.info(
            "Request received: start=${request.startTime}, max duration=${request.maximumRunTime}"
        )
        return try {
            // parse input data
            val infra = infraManager.getInfra(request.infra, request.expectedVersion, recorder)
            val temporarySpeedLimitManager =
                buildTemporarySpeedLimitManager(infra, request.temporarySpeedLimits)
            val rollingStock =
                parseRawRollingStock(
                    request.physicsConsist,
                    request.rollingStockLoadingGauge,
                    request.rollingStockSupportedSignalingSystems
                )
            val trainsRequirements =
                parseTrainsRequirements(request.trainsRequirements, request.startTime)
                    .toMutableList()
            val convertedWorkSchedules =
                convertWorkScheduleCollection(infra.rawInfra, request.workSchedules)
            trainsRequirements.add(convertedWorkSchedules)
            val spacingRequirements = trainsRequirements.flatMap { it.spacingRequirements }
            val steps = parseSteps(infra, request.pathItems, request.startTime)

            // Run the STDCM pathfinding
            val path =
                findPath(
                    infra,
                    rollingStock,
                    request.comfort,
                    0.0,
                    steps,
                    makeBlockAvailability(
                        spacingRequirements,
                        gridMarginBeforeTrain = request.timeGapBefore.seconds,
                        gridMarginAfterTrain = request.timeGapAfter.seconds,
                        timeStep = request.timeStep!!.seconds
                    ),
                    request.timeStep.seconds,
                    request.maximumDepartureDelay!!.seconds,
                    request.maximumRunTime.seconds,
                    request.speedLimitTag,
                    parseMarginValue(request.margin),
                    Pathfinding.TIMEOUT,
                    temporarySpeedLimitManager,
                )
            if (path == null) {
                val response = PathNotFound()
                return RsJson(RsWithBody(stdcmResponseAdapter.toJson(response)))
            }
            val pathfindingResponse = runPathfindingBlockPostProcessing(infra, path.blocks)

            val simulationResponse =
                buildSimResponse(
                    infra,
                    path,
                    rollingStock,
                    request.speedLimitTag,
                    temporarySpeedLimitManager,
                    request.comfort
                )

            // Check for conflicts
            checkForConflicts(trainsRequirements, simulationResponse, path.departureTime)

            val departureTime =
                request.startTime.plus(ofMillis((path.departureTime * 1000).toLong()))
            val response = STDCMSuccess(simulationResponse, pathfindingResponse, departureTime)
            RsJson(RsWithBody(stdcmResponseAdapter.toJson(response)))
        } catch (ex: Throwable) {
            ExceptionHandler.handle(ex)
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
                RJSTrainStop.RJSReceptionSignal.STOP
            )
        )
        val reportTrain =
            runScheduleMetadataExtractor(
                path.envelope,
                path.trainPath,
                path.chunkPath,
                infra,
                path.routePath.toIdxList(),
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
                reportTrain.pathItemTimes
            )
        val speedLimits =
            computeMRSP(
                path.trainPath,
                rollingStock,
                false,
                speedLimitTag,
                temporarySpeedLimitManager
            )

        // All simulations are the same for now
        return SimulationSuccess(
            base = simpleReportTrain,
            provisional = simpleReportTrain,
            finalOutput = reportTrain,
            mrsp = makeMRSPResponse(speedLimits),
            electricalProfiles = buildSTDCMElectricalProfiles(infra, path, rollingStock, comfort),
        )
    }

    /** Build the electrical profiles from the path */
    private fun buildSTDCMElectricalProfiles(
        infra: FullInfra,
        path: STDCMResult,
        rollingStock: RollingStock,
        comfort: Comfort
    ): RangeValues<ElectricalProfileValue> {
        val envelopeSimPath = EnvelopeTrainPath.from(infra.rawInfra, path.trainPath, null)
        val electrificationMap =
            envelopeSimPath.getElectrificationMap(
                rollingStock.basePowerClass,
                ImmutableRangeMap.of(),
                rollingStock.powerRestrictions,
                false
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
    speedLimits: Collection<STDCMTemporarySpeedLimit>
): TemporarySpeedLimitManager {
    var outputSpeedLimits: MutableMap<DirTrackChunkId, DistanceRangeMap<SpeedLimitProperty>> =
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
                var startOffset = Distance.max(0.meters, trackRange.begin - chunkStartOffset)
                var endOffset = Distance.min(trackChunkLength, trackRange.end - chunkStartOffset)
                var direction =
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
                                null
                            )
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
                        }
                    )
                } else {
                    outputSpeedLimits.put(dirTrackChunkId, chunkSpeedLimitRangeMap)
                }
            }
        }
    }
    return TemporarySpeedLimitManager(outputSpeedLimits)
}

private fun parseSteps(
    infra: FullInfra,
    pathItems: List<STDCMPathItem>,
    startTime: ZonedDateTime
): List<STDCMStep> {
    if (pathItems.last().stopDuration == null) {
        throw OSRDError(ErrorType.MissingLastSTDCMStop)
    }
    if (pathItems.any { it.stopDuration == null && it.stepTimingData != null }) {
        throw OSRDError(ErrorType.InvalidSTDCMStepWithTimingData)
    }

    // Semantically a stop at the start location doesn't change anything,
    // it's not *wrong* so there's no error, but it's easier to consider
    // that it's not a stop.
    pathItems.first().stopDuration = null

    return pathItems
        .map {
            STDCMStep(
                findWaypointBlocks(infra, it.locations),
                it.stopDuration?.seconds,
                it.stopDuration != null,
                if (it.stepTimingData != null)
                    PlannedTimingData(
                        TimeDelta(between(startTime, it.stepTimingData.arrivalTime).toMillis()),
                        it.stepTimingData.arrivalTimeToleranceBefore,
                        it.stepTimingData.arrivalTimeToleranceAfter
                    )
                else null
            )
        }
        .toList()
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

/** Sanity check, we assert that the result is not conflicting with the scheduled timetable */
private fun checkForConflicts(
    timetableTrainRequirements: List<Requirements>,
    simResult: SimulationSuccess,
    departureTime: Double
) {
    // Shifts the requirements generated by the new train to account for its departure time
    val newTrainSpacingRequirement =
        simResult.finalOutput.spacingRequirements.map {
            SpacingRequirement(
                it.zone,
                it.beginTime + departureTime.seconds,
                it.endTime + departureTime.seconds
            )
        }
    val conflictDetector = incrementalConflictDetectorFromReq(timetableTrainRequirements)
    val spacingRequirements = parseSpacingRequirements(newTrainSpacingRequirement)
    val conflicts = conflictDetector.analyseConflicts(spacingRequirements)
    assert(conflicts is NoConflictResponse) {
        "STDCM result is conflicting with the scheduled timetable"
    }
}

private fun findWaypointBlocks(
    infra: FullInfra,
    waypoints: Collection<TrackLocation>
): Set<PathfindingEdgeLocationId<Block>> {
    val waypointBlocks = HashSet<PathfindingEdgeLocationId<Block>>()
    for (waypoint in waypoints) {
        for (direction in Direction.entries) {
            waypointBlocks.addAll(findWaypointBlocks(infra, waypoint, direction))
        }
    }
    return waypointBlocks
}
