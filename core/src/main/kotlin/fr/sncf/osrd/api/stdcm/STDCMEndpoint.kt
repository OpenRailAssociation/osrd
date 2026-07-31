@file:OptIn(ExperimentalSerializationApi::class)

package fr.sncf.osrd.api.stdcm

import com.google.common.collect.Range
import com.google.common.collect.TreeRangeSet
import com.rabbitmq.client.AMQP
import com.rabbitmq.client.Channel
import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.*
import fr.sncf.osrd.api.pathfinding.PathfindingBlockResponse
import fr.sncf.osrd.api.pathfinding.findStopPositionAtEndOfBlockConsideringRollingStock
import fr.sncf.osrd.api.pathfinding.findWaypointBlocks
import fr.sncf.osrd.api.pathfinding.hasDuplicateTracks
import fr.sncf.osrd.api.pathfinding.runPathfindingBlockPostProcessing
import fr.sncf.osrd.api.standalone_sim.*
import fr.sncf.osrd.cli.*
import fr.sncf.osrd.conflicts.ParsedRequirements
import fr.sncf.osrd.envelope.concatenateAndShiftEnvelopes
import fr.sncf.osrd.envelope_sim.Comfort
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue.Percentage
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue.TimePerDistance
import fr.sncf.osrd.envelope_sim_infra.computeMRSP
import fr.sncf.osrd.pathfinding.Pathfinding
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.signaling.etcs_level2.ETCS_LEVEL2
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.TemporarySpeedLimitManager
import fr.sncf.osrd.standalone_sim.makeElectricalProfiles
import fr.sncf.osrd.standalone_sim.makeMRSPResponse
import fr.sncf.osrd.standalone_sim.result.ElectrificationRange
import fr.sncf.osrd.standalone_sim.runScheduleMetadataExtractor
import fr.sncf.osrd.stdcm.STDCMCompleteResult
import fr.sncf.osrd.stdcm.STDCMPartialResult
import fr.sncf.osrd.stdcm.graph.STDCMGraph
import fr.sncf.osrd.stdcm.graph.checkPlannedStepsAndMaybeIndex
import fr.sncf.osrd.stdcm.graph.findPath
import fr.sncf.osrd.stdcm.graph.logger
import fr.sncf.osrd.stdcm.infra_exploration.ExplorerStep
import fr.sncf.osrd.stdcm.infra_exploration.PlannedTimingData
import fr.sncf.osrd.stdcm.preprocessing.implementation.makeBlockAvailability
import fr.sncf.osrd.stdcm.tracing.FailureExplainer
import fr.sncf.osrd.stdcm.tracing.ProgressCallback
import fr.sncf.osrd.stdcm.tracing.STDCMProgress
import fr.sncf.osrd.stdcm.tracing.STDCMProgressStatus
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.DistanceRangeMap.RangeMapEntry
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.offsetRangeMapOf
import fr.sncf.osrd.utils.units.*
import io.opentelemetry.api.trace.Span
import io.opentelemetry.api.trace.SpanKind
import io.opentelemetry.instrumentation.annotations.WithSpan
import java.io.File
import java.time.Duration
import java.time.Duration.between
import java.time.Duration.ofMillis
import java.time.LocalDateTime
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.TreeMap
import kotlin.math.max
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.ExperimentalSerializationApi

class STDCMEndpoint(
    private val infraManager: InfraProvider,
    private val timetableCacheManager: TimetableCacheManager,
    private val s3Context: S3Context? = null,
) : Take {
    data class STDCMFinalResult(
        @Json(name = "status") val status: STDCMProgressStatus,
        @Json(name = "result") val result: STDCMResponse,
    ) {
        companion object {
            val adapter: JsonAdapter<STDCMFinalResult> =
                Moshi.Builder()
                    .addLast(STDCMResponse::class.java, stdcmResponseAdapter)
                    .addLast(KotlinJsonAdapterFactory())
                    .build()
                    .adapter(STDCMFinalResult::class.java)
        }
    }

    override fun requiresQueueCtx(): Boolean {
        // We need access to the queue to send the intermediate STDCM progress payloads
        return true
    }

    @Throws(OSRDError::class)
    override fun act(req: Request, ctx: Take.QueueContext?): Response {
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

        return run(request, ctx)
    }

    @WithSpan(value = "Reading request content", kind = SpanKind.SERVER)
    private fun readRequest(req: Request): STDCMRequest? {
        val body = req.body()
        return stdcmRequestAdapter.fromJson(body)
    }

    /** Process the given parsed request */
    @WithSpan(value = "Processing STDCM request", kind = SpanKind.SERVER)
    fun run(request: STDCMRequest, ctx: Take.QueueContext?): Response {
        logger.info(
            "Request received: start=${request.startTime}, max duration=${request.maximumRunTime}"
        )
        return try {
            // parse input data
            val infra = infraManager.getInfra(request.infra, request.expectedVersion)
            val allowedTrackSections = parseTrackSectionIds(infra, request.allowedTrackSections)
            val temporarySpeedLimitManager =
                buildTemporarySpeedLimitManager(infra, request.temporarySpeedLimits)
            val consistConfigurations =
                request.consistSchedule.values.map { it ->
                    it.copy(
                        supportedSignalingSystems =
                            it.supportedSignalingSystems.filter {
                                // Ignoring ETCS as it is not (yet) supported for STDCM
                                it != ETCS_LEVEL2.id
                            }
                    )
                }
            val requestConsistSchedule =
                request.consistSchedule.copy(values = consistConfigurations)
            val consistSchedules =
                ConsistSchedule(
                    requestConsistSchedule,
                    infra,
                    allowedTrackSections,
                    request.pathItems.size,
                )
            val steps =
                parseSteps(
                    infra,
                    request.pathItems,
                    request.startTime,
                    consistSchedules.rollingStocks.map { it.length },
                )
            val requirements = getRequirements(request, infra, timetableCacheManager)

            val fullFailureExplainer =
                FailureExplainer(request.startTime, infra.rawInfra, infra.blockInfra)

            val workSchedulesFailureExplainer =
                FailureExplainer(
                    request.startTime,
                    infra.rawInfra,
                    infra.blockInfra,
                    maxLargestConflicts = 2,
                    maxClosestConflicts = 1,
                )

            var callback: ProgressCallback? = null
            if (ctx != null) {
                callback = { progressCallback(ctx.chan, ctx.replyTo, ctx.correlationId, it) }
            }

            // Run the STDCM pathfinding
            val path =
                findPath(
                    infra,
                    consistSchedules,
                    request.comfort,
                    0.0,
                    steps,
                    makeBlockAvailability(
                        requirements.requirements,
                        gridMarginBeforeTrain = request.timeGapBefore.seconds,
                        gridMarginAfterTrain = request.timeGapAfter.seconds,
                        timeStep = request.timeStep!!.seconds,
                        requirementsWithMetadata = requirements,
                    ),
                    request.timeStep.seconds,
                    request.maximumDepartureDelay!!.seconds,
                    request.maximumRunTime.seconds,
                    request.consistSchedule.values[0].speedLimitTag,
                    parseMarginValue(request.margin),
                    Pathfinding.TIMEOUT,
                    temporarySpeedLimitManager,
                    STDCMGraph.SearchMetadata(request.startTime, requirements.metadata, s3Context),
                    fullFailureExplainer,
                    workSchedulesFailureExplainer,
                    callback,
                )

            fullFailureExplainer.saveReport(s3Context)
            if (path is STDCMCompleteResult && !hasDuplicateTracks(infra, path.trainPath)) {
                val pathfindingResponse =
                    runPathfindingBlockPostProcessing(
                        infra,
                        path.trainPath,
                        path.waypointOffsets,
                        path.backtrackIndexes,
                    )

                val simulationResponse =
                    buildSimResponse(
                        infra,
                        path,
                        request.consistSchedule.values[0].speedLimitTag,
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
                    s3Context,
                )

                val result = STDCMSuccess(simulationResponse, pathfindingResponse, departureTime)
                val response = STDCMFinalResult(status = STDCMProgressStatus.DONE, result = result)
                return RsJson(RsWithBody(STDCMFinalResult.adapter.toJson(response)))
            }

            val report = workSchedulesFailureExplainer.makeReport()
            val mostBlockingWorkScheduleIds = report.largestConflicts.map { it.source.id }
            val nearestToDestinationWorkScheduleIds = report.closestConflicts.map { it.source.id }
            var partialPathfindingResult: PathfindingBlockResponse? = null
            var lastReachedOperationalPoint: LastReachedOperationalPoint? = null

            if (path is STDCMPartialResult) {
                partialPathfindingResult =
                    runPathfindingBlockPostProcessing(
                        infra,
                        path.trainPath,
                        path.waypointOffsets,
                        path.backtrackIndexes,
                    )
                val name =
                    path.trainPath
                        .getOperationalPointParts()
                        .asSequence()
                        .mapNotNull {
                            infra.rawInfra.getOperationalPointPartOpId(it.value)
                        }
                        .last()
                val arrivalTime =
                    request.startTime.plus(Duration.ofSeconds(path.earliestReachableTime.toLong()))
                lastReachedOperationalPoint =
                    LastReachedOperationalPoint(name, path.geoPoint, arrivalTime)
            }

            val result =
                PathNotFound(
                    mostBlockingWorkScheduleIds,
                    nearestToDestinationWorkScheduleIds,
                    partialPathfindingResult,
                    lastReachedOperationalPoint,
                )
            val response = STDCMFinalResult(status = STDCMProgressStatus.DONE, result = result)
            RsJson(RsWithBody(STDCMFinalResult.adapter.toJson(response)))
        } catch (ex: Throwable) {
            ExceptionHandler.handle(ex)
        }
    }

    companion object {
        /**
         * If the env variable is set, dump a json file there with all data that may be relevant for
         * debug. The feature and env variable isn't properly documented yet, it should soon be
         * linked to an object storage.
         */
        fun logDebugData(
            infra: RawInfra,
            path: STDCMCompleteResult,
            simulationResponse: SimulationSuccess,
            departureTime: ZonedDateTime,
            requirements: Map<ZoneId, List<STDCMTimetableData.DetailedRequirement>>,
            s3Context: S3Context? = null,
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
        fun buildSimResponse(
            infra: FullInfra,
            path: STDCMCompleteResult,
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
                    StopDetails(0.1.seconds, RJSTrainStop.RJSReceptionSignal.STOP, false),
                )
            )
            val reportTrain =
                runScheduleMetadataExtractor(
                    path.envelope,
                    path.trainPath,
                    infra,
                    path.rollingStocks as DistanceRangeMap<PhysicsRollingStock>,
                    scheduleItems,
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
                concatenateAndShiftEnvelopes(
                    path.rollingStocks.map {
                        computeMRSP(
                            path.trainPath.subPath(Offset(it.lower), Offset(it.upper)),
                            it.value,
                            false,
                            speedLimitTag,
                            temporarySpeedLimitManager,
                        )
                    }
                )

            // All simulations are the same for now
            return SimulationSuccess(
                base = simpleReportTrain,
                provisional = simpleReportTrain,
                finalOutput = reportTrain,
                mrsp = makeMRSPResponse(speedLimits),
                electricalProfiles =
                    buildSTDCMElectricalProfiles(path, path.rollingStocks, comfort),
            )
        }

        /** Build the electrical profiles from the path */
        fun buildSTDCMElectricalProfiles(
            path: STDCMCompleteResult,
            rollingStocks: DistanceRangeMap<RollingStock>,
            comfort: Comfort,
        ): RangeValues<ElectricalProfileValue> {
            var currentOffset = 0.0.meters
            val electricalProfiles = rollingStocks.map {
                val electrificationMap =
                    path.trainPath
                        .subPath(Offset(it.lower), Offset(it.upper))
                        .getElectrificationMap(
                            it.value.basePowerClass,
                            offsetRangeMapOf(),
                            it.value.powerRestrictions,
                            false,
                        )
                val curvesAndConditions =
                    it.value.mapTractiveEffortCurves(electrificationMap, comfort)
                val electrificationRanges =
                    ElectrificationRange.from(
                        curvesAndConditions.conditions,
                        electrificationMap,
                    )
                val electricalProfiles =
                    makeElectricalProfiles(electrificationRanges).shifted(currentOffset)
                currentOffset = it.upper
                electricalProfiles
            }
            return electricalProfiles.reduce { acc, newRange ->
                RangeValues(
                    internalBoundaries = acc.internalBoundaries + newRange.internalBoundaries,
                    values = acc.values + newRange.values,
                )
            }
        }
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
    rollingStockLengths: List<Double>,
): List<ExplorerStep> {
    require(rollingStockLengths.size == pathItems.size)
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
            val rollingStockLength =
                max(rollingStockLengths[index], rollingStockLengths.getOrElse(index - 1) { 0.0 })
            ExplorerStep(
                if (index != 0 && index != pathItems.size - 1) {
                    val destinationBlock =
                        findWaypointBlocks(infra, pathItems.last().pathItem.locations)
                    findWaypointBlocks(infra, it.pathItem.locations).map { waypointBlock ->
                        findStopPositionAtEndOfBlockConsideringRollingStock(
                            waypointBlock,
                            destinationBlock,
                            rollingStockLength,
                            infra,
                        )
                    }
                } else {
                    findWaypointBlocks(infra, it.pathItem.locations)
                },
                it.stopDuration?.seconds,
                it.stopDuration != null,
                it.pathItem.canBacktrack,
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

    // Train and work schedule requirements are both relative to EPOCH.
    // Shift them into the search window.
    val searchWindowBeginEpoch = request.startTime.durationSinceEpoch()
    val searchWindowEndEpoch =
        searchWindowBeginEpoch +
            request.maximumDepartureDelay!!.seconds +
            request.maximumRunTime.seconds

    for (convertedWorkSchedule in
        convertWorkScheduleCollection(infra.rawInfra, request.workSchedules)) {
        for (spacingReq in convertedWorkSchedule.spacingRequirements) {
            val begin = spacingReq.beginTime - searchWindowBeginEpoch
            val end = spacingReq.endTime - searchWindowBeginEpoch
            val set = requirements.computeIfAbsent(spacingReq.zone) { TreeRangeSet.create() }
            set.add(Range.closedOpen(begin, end))
            metadata
                .computeIfAbsent(spacingReq.zone) { mutableListOf() }
                .add(STDCMTimetableData.DetailedRequirement(begin, end, convertedWorkSchedule.id))
        }
    }

    val trainRequirements = runBlocking { timetableCacheManager.get(infra, request.timetableId) }
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
                        metadata.source,
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
    return dedupScheduleItems(
        trainStops.map {
            val duration = if (it.duration > 0.0) it.duration.seconds else null
            val stopDetails =
                if (duration != null) StopDetails(duration, it.receptionSignal, false) else null
            SimulationScheduleItem(Offset(it.position.meters), null, stopDetails)
        }
    )
}

fun parseTrackSectionIds(infra: FullInfra, trackSectionNames: Set<String>): Set<TrackSectionId> {
    return trackSectionNames.mapNotNull { infra.rawInfra.getTrackSectionFromName(it) }.toSet()
}

private fun progressCallback(
    channel: Channel,
    replyTo: String,
    correlationId: String,
    data: STDCMProgress,
) {
    val properties =
        AMQP.BasicProperties()
            .builder()
            .headers(
                mapOf("x-non-terminating-response" to true, "x-status" to "ok".encodeToByteArray())
            )
            .correlationId(correlationId)
            .build()
    val body = STDCMProgress.adapter.toJson(data).encodeToByteArray()

    channel.basicPublish("", replyTo, properties, body)
}
