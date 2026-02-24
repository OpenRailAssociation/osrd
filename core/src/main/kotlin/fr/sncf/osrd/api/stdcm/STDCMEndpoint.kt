@file:OptIn(ExperimentalSerializationApi::class)

package fr.sncf.osrd.api.stdcm

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.Range
import com.google.common.collect.TreeRangeSet
import fr.sncf.osrd.api.*
import fr.sncf.osrd.api.pathfinding.findStopPositionAtEndOfBlockConsideringRollingStock
import fr.sncf.osrd.api.pathfinding.findWaypointBlocks
import fr.sncf.osrd.api.pathfinding.hasDuplicateTracks
import fr.sncf.osrd.api.pathfinding.runPathfindingBlockPostProcessing
import fr.sncf.osrd.api.standalone_sim.*
import fr.sncf.osrd.cli.Request
import fr.sncf.osrd.cli.Response
import fr.sncf.osrd.cli.RsJson
import fr.sncf.osrd.cli.RsText
import fr.sncf.osrd.cli.RsWithBody
import fr.sncf.osrd.cli.RsWithStatus
import fr.sncf.osrd.cli.Take
import fr.sncf.osrd.conflicts.ParsedRequirements
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue.Percentage
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue.TimePerDistance
import fr.sncf.osrd.envelope_sim_infra.computeMRSP
import fr.sncf.osrd.pathfinding.Pathfinding
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.signaling.etcs_level2.ETCS_LEVEL2
import fr.sncf.osrd.sim_infra.api.DirTrackChunkId
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.SpeedLimitProperty
import fr.sncf.osrd.sim_infra.api.TrackSectionId
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.sim_infra.impl.TemporarySpeedLimitManager
import fr.sncf.osrd.standalone_sim.makeElectricalProfiles
import fr.sncf.osrd.standalone_sim.makeMRSPResponse
import fr.sncf.osrd.standalone_sim.result.ElectrificationRange
import fr.sncf.osrd.standalone_sim.runScheduleMetadataExtractor
import fr.sncf.osrd.stdcm.STDCMResult
import fr.sncf.osrd.stdcm.graph.STDCMGraph
import fr.sncf.osrd.stdcm.graph.checkPlannedStepsAndMaybeIndex
import fr.sncf.osrd.stdcm.graph.findPath
import fr.sncf.osrd.stdcm.graph.logger
import fr.sncf.osrd.stdcm.infra_exploration.ExplorerStep
import fr.sncf.osrd.stdcm.infra_exploration.PlannedTimingData
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
import kotlinx.serialization.ExperimentalSerializationApi

class STDCMEndpoint(
    private val infraManager: InfraProvider,
    private val timetableCacheManager: TimetableCacheManager,
    private val s3Context: S3Context? = null,
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

        s3Context?.writeSTDCMFile("input_payload.json") { stdcmRequestAdapter.toJson(request) }

        return run(request)
    }

    @WithSpan(value = "Reading request content", kind = SpanKind.SERVER)
    private fun readRequest(req: Request): STDCMRequest? {
        val body = req.body()
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
            val steps = parseSteps(infra, request.pathItems, request.startTime, rollingStock.length)
            val requirements = getRequirements(request, infra, timetableCacheManager)
            val allowedTrackSections = parseTrackSectionIds(infra, request.allowedTrackSections)

            // Run the STDCM pathfinding
            val path =
                findPath(
                    infra,
                    rollingStock,
                    request.comfort,
                    0.0,
                    steps,
                    makeBlockAvailability(
                        requirements.requirements,
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
                    allowedTrackSections,
                    STDCMGraph.SearchMetadata(request.startTime, requirements.metadata, s3Context),
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

            logDebugData(
                infra.rawInfra,
                path,
                simulationResponse,
                departureTime,
                requirements.metadata,
            )

            val response = STDCMSuccess(simulationResponse, pathfindingResponse, departureTime)
            RsJson(RsWithBody(stdcmResponseAdapter.toJson(response)))
        } catch (ex: Throwable) {
            ExceptionHandler.handle(ex)
        }
    }

    /**
     * If the env variable is set, dump a json file there with all data that may be relevant for
     * debug. The feature and env variable isn't properly documented yet, it should soon be linked
     * to an object storage.
     */
    private fun logDebugData(
        infra: RawInfra,
        path: STDCMResult,
        simulationResponse: SimulationSuccess,
        departureTime: ZonedDateTime,
        requirements: Map<ZoneId, List<STDCMTimetableData.DetailedRequirement>>,
    ) {
        val stringDebugData by lazy {
            OutputSimDebugData.adapter.toJson(
                generateDebugData(infra, path, simulationResponse, departureTime, requirements)
            )
        }

        val filename = System.getenv("STDCM_DEBUG_DATA_FILENAME")
        if (filename != null) {
            File(filename).writeText(stringDebugData)
        }

        s3Context?.writeSTDCMFile("output_simulation_data.json") { stringDebugData }
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
                path.trainPath.getLength(),
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

fun parseSteps(
    infra: FullInfra,
    pathItems: List<STDCMPathItem>,
    startTime: ZonedDateTime,
    rollingStockLength: Double,
): List<ExplorerStep> {
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

    return pathItems
        .mapIndexed { index, it ->
            ExplorerStep(
                if (index != 0 && index != pathItems.size - 1) {
                    val destinationBlock = findWaypointBlocks(infra, pathItems.last().locations)
                    findWaypointBlocks(infra, it.locations).map { waypointBlock ->
                        findStopPositionAtEndOfBlockConsideringRollingStock(
                            waypointBlock,
                            destinationBlock,
                            rollingStockLength,
                            infra,
                        )
                    }
                } else {
                    findWaypointBlocks(infra, it.locations)
                },
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
        .toList()
}

/** This is what's kept in cache: the data used to identify conflicts, and some metadata. */
class RequirementsWithMetadata(
    // Map of (un)available times, in a format that enables fast queries during the search
    val requirements: ParsedRequirements,
    // Metadata for the occupied ranges, to identify which train it comes from.
    // Used in the generated trace data to see where the new train fits in an external timetable.
    val metadata: Map<ZoneId, List<STDCMTimetableData.DetailedRequirement>>,
)

/**
 * Collect all spacing requirements in an easily fetchable format. Combines both train requirements
 * and work schedules.
 */
fun getRequirements(
    request: STDCMRequest,
    infra: FullInfra,
    timetableCacheManager: TimetableCacheManager,
): RequirementsWithMetadata {
    val requirements = mutableMapOf<ZoneId, TreeRangeSet<Double>>()
    val metadata = mutableMapOf<ZoneId, MutableList<STDCMTimetableData.DetailedRequirement>>()
    convertWorkScheduleCollection(infra.rawInfra, request.workSchedules)
        .spacingRequirements
        .forEach { spacingReq ->
            val set = requirements.computeIfAbsent(spacingReq.zone) { TreeRangeSet.create() }
            set.add(Range.closedOpen(spacingReq.beginTime, spacingReq.endTime))
            metadata
                .computeIfAbsent(spacingReq.zone) { mutableListOf() }
                .add(
                    STDCMTimetableData.DetailedRequirement(
                        spacingReq.beginTime,
                        spacingReq.endTime,
                        "work schedule",
                    )
                )
        }

    val trainRequirements = runBlocking { timetableCacheManager.get(infra, request.timetableId) }
    // Cached requirements are relative to EPOCH. Add time diff with request start time
    // to these requirements.
    val searchWindowBeginEpoch = request.startTime.durationSinceEpoch()
    val searchWindowEndEpoch =
        searchWindowBeginEpoch +
            request.maximumDepartureDelay!!.seconds +
            request.maximumRunTime.seconds
    for ((zoneId, rangeSet) in trainRequirements.zoneUses) {
        val setBuilder = requirements.computeIfAbsent(zoneId) { TreeRangeSet.create() }
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

    for (entry in trainRequirements.detailedRequirements) {
        val metadataList = metadata.computeIfAbsent(entry.key) { mutableListOf() }
        for (metadata in entry.value) {
            val included =
                metadata.from > searchWindowBeginEpoch && metadata.to < searchWindowEndEpoch
            if (included) {
                metadataList.add(
                    STDCMTimetableData.DetailedRequirement(
                        metadata.from - searchWindowBeginEpoch,
                        metadata.to - searchWindowBeginEpoch,
                        metadata.trainName,
                    )
                )
            }
        }
    }
    return RequirementsWithMetadata(
        requirements.mapValues { rangeSet ->
            TreeMap(rangeSet.value.asRanges().associateBy { it.upperEndpoint() })
        },
        metadata,
    )
}

fun parseMarginValue(margin: MarginValue): AllowanceValue? {
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

fun parseTrackSectionIds(infra: FullInfra, trackSectionName: Set<String>?): Set<TrackSectionId>? {
    return trackSectionName?.mapNotNull { infra.rawInfra.getTrackSectionFromName(it) }?.toSet()
}
