package fr.sncf.osrd.stdcm.graph

import com.squareup.moshi.Json
import fr.sncf.osrd.api.stdcm.OutputSimDebugData
import fr.sncf.osrd.api.stdcm.generatePartialDebugData
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.concatenateAndShiftEnvelopes
import fr.sncf.osrd.envelope_sim.Comfort
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.allowances.AllowanceRange
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance
import fr.sncf.osrd.envelope_sim.pipelines.SimStop
import fr.sncf.osrd.envelope_sim.pipelines.maxEffortEnvelopeFrom
import fr.sncf.osrd.envelope_sim.pipelines.maxSpeedEnvelopeFrom
import fr.sncf.osrd.envelope_sim_infra.computeMRSP
import fr.sncf.osrd.path.implementations.SubPhysicsPath
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.impl.TemporarySpeedLimitManager
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.areSpeedsEqual
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.io.File
import java.util.*
import kotlin.math.max
import kotlin.math.min
import org.slf4j.Logger
import org.slf4j.LoggerFactory

val postProcessingLogger: Logger = LoggerFactory.getLogger("postprocessing-STDCM")

data class FixedTimePoint(
    val time: Double,
    val offset: Offset<PhysicsPath>,
    val stopTime: Double?,
) : Comparable<FixedTimePoint> {
    override fun compareTo(other: FixedTimePoint): Int {
        return offset.compareTo(other.offset)
    }
}

data class EngineeringAllowanceRange(
    val from: Offset<PhysicsPath>,
    val to: Offset<PhysicsPath>,
    @Json(name = "added_duration") val addedDuration: Double,
)

data class FinalEnvelopeResult(
    val envelope: Envelope,
    val engineeringAllowanceRanges: List<EngineeringAllowanceRange>,
)

data class ConsistChange(val rollingStock: RollingStock, val end: Offset<PhysicsPath>)

/**
 * Build the final envelope, this time without any approximation. Apply the allowances properly. The
 * simulations can be approximations up to this point (when exploring the graph), this is where we
 * transition to a precise simulation.
 *
 * We build the simulation iteratively, by adding fixed time points (points where we must arrive at
 * a given time). We start with fixed points only at train stops, and we try to run a simulation. If
 * conflicts happen, we add a new fixed time point at the conflict location. This process is
 * repeated until we find a solution without conflict. We may also stop if an error happens
 * (including a conflict at a location that already has a fixed time).
 */
fun buildFinalEnvelope(
    graph: STDCMGraph,
    edges: List<STDCMEdge>,
    standardAllowance: AllowanceValue?,
    envelopeSimPath: PhysicsPath,
    consistChanges: List<ConsistChange>,
    timeStep: Double,
    comfort: Comfort?,
    blockAvailability: BlockAvailabilityInterface,
    stops: List<TrainStop>,
    updatedTimeData: TimeData,
    isMareco: Boolean = true,
    attempt: Int = 0,
): FinalEnvelopeResult {
    val fullInfraExplorer = edges.last().infraExplorerWithNewEnvelope
    val maxSpeedEnvelopes =
        makeMaxSpeedEnvelopes(
            fullInfraExplorer.buildFullPath(graph.rawInfra, graph.blockInfra),
            stops,
            consistChanges,
            timeStep,
            comfort,
            graph.tag,
            graph.temporarySpeedLimitManager,
            areSpeedsEqual(0.0, edges.last().endSpeed),
        )

    val pathLength =
        Length<PhysicsPath>(Distance(millimeters = edges.sumOf { it.length.distance.millimeters }))
    val allowanceRanges = getEngineeringAllowanceRanges(edges)
    assert(fullInfraExplorer.isPathComplete)
    val fixedPoints =
        initFixedPoints(
            edges,
            stops,
            pathLength,
            standardAllowance != null &&
                standardAllowance.getAllowanceTime(
                    maxSpeedEnvelopes.sumOf { it.totalTime },
                    pathLength.meters,
                ) > 0.0,
            updatedTimeData,
            allowanceRanges,
        )
    require(concatenateAndShiftEnvelopes(maxSpeedEnvelopes).continuous)
    val maxIterations = edges.size * 2 // just to avoid infinite loops on bugs or edge cases
    repeat(maxIterations) {
        try {
            val newEnvelope =
                concatenateAndShiftEnvelopes(
                    runSimulationWithFixedPoints(
                        maxSpeedEnvelopes,
                        envelopeSimPath,
                        consistChanges.map { it.rollingStock },
                        fixedPoints,
                        isMareco,
                        timeStep,
                        comfort,
                    )
                )
            val conflictOffset =
                findConflictOffsets(newEnvelope, blockAvailability, edges, updatedTimeData)
                    ?: return FinalEnvelopeResult(newEnvelope, allowanceRanges)
            if (fixedPoints.any { it.offset == conflictOffset }) {
                // Error case: a conflict prevents us from finding a solution,
                // despite the exploration data identifying a valid opening.
                // This is not supposed to happen, but we can still fallback
                // linear allowance, and log as much info as we can
                val maxSpeedEnvelope = concatenateAndShiftEnvelopes(maxSpeedEnvelopes)
                return handlePostProcessingConflict(
                    graph,
                    maxSpeedEnvelope,
                    edges,
                    standardAllowance,
                    envelopeSimPath,
                    consistChanges,
                    timeStep,
                    comfort,
                    blockAvailability,
                    stops,
                    updatedTimeData,
                    fixedPoints,
                    conflictOffset,
                    isMareco,
                    allowanceRanges,
                    attempt,
                )
            }
            val newPoint =
                makeFixedPoint(
                    fixedPoints,
                    edges,
                    conflictOffset,
                    pathLength,
                    updatedTimeData,
                    allowanceRanges,
                )
            postProcessingLogger.info(
                "Conflict when running final stdcm simulation at offset $conflictOffset, adding a fixed time point: $newPoint"
            )
            fixedPoints.add(newPoint)
        } catch (e: OSRDError) {
            if (e.osrdErrorType == ErrorType.AllowanceConvergenceTooMuchTime) {
                // Mareco allowances must have a non-zero capacity speed limit,
                // which may cause "too much time" errors.
                // We can ignore this exception and move on to the linear allowance as fallback
                postProcessingLogger.warn(
                    "Can't slow down enough to match the given standard allowance"
                )
                return@repeat
            } else if (e.osrdErrorType == ErrorType.AllowanceConvergenceDiscontinuity) {
                // May be caused by this bug:
                // https://github.com/OpenRailAssociation/osrd/issues/9037
                // It's quite difficult to fix this issue for now, but we can
                // still fallback on linear allowance to have a result
                postProcessingLogger.warn("Discontinuity in mareco search space")
                return@repeat
            }
            if (e.osrdErrorType == ErrorType.ImpossibleSimulationError) {
                // Generic simulation errors, they can (very rarely) happen with mareco.
                // For example when the train stops during/after a coasting.
                postProcessingLogger.warn("Impossible simulation")
                return@repeat
            } else throw e
        }
    }
    if (!isMareco) {
        throw RuntimeException(
            "Failed to compute a standard allowance that wouldn't cause conflicts"
        )
    } else {
        postProcessingLogger.warn(
            "Failed to compute a mareco standard allowance, fallback to linear allowance"
        )
        return buildFinalEnvelope(
            graph,
            edges,
            standardAllowance,
            envelopeSimPath,
            consistChanges,
            timeStep,
            comfort,
            blockAvailability,
            stops,
            updatedTimeData,
            false,
        )
    }
}

/** Initialize all fixed points at stop locations, including stop durations. */
private fun initFixedPoints(
    edges: List<STDCMEdge>,
    stops: List<TrainStop>,
    length: Length<PhysicsPath>,
    hasStandardAllowance: Boolean,
    updatedTimeData: TimeData,
    allowanceRanges: List<EngineeringAllowanceRange>,
): TreeSet<FixedTimePoint> {
    val res = TreeSet<FixedTimePoint>()

    // Add all the stops, with the right stop duration
    var prevStopTime = 0.0
    for (stop in stops) {
        res.add(
            makeFixedPoint(
                res,
                edges,
                Offset(Distance.fromMeters(stop.position)),
                length,
                updatedTimeData,
                allowanceRanges,
                stop.duration,
            )
        )
        prevStopTime += stop.duration
    }

    // Add one point at the end to match the standard allowance (if any)
    if (hasStandardAllowance && res.none { it.offset == length })
        res.add(makeFixedPoint(res, edges, length, length, updatedTimeData, allowanceRanges))

    // Add points at the end of each engineering allowance
    val allowanceEndOffsets = mutableListOf<Offset<PhysicsPath>>()
    for ((from, to, _) in allowanceRanges) {
        // When ranges overlap, we start with just the last point
        allowanceEndOffsets.removeIf { it > from }
        allowanceEndOffsets.add(to)
    }
    for (offset in allowanceEndOffsets) {
        if (res.none { it.offset == offset }) {
            res.add(makeFixedPoint(res, edges, offset, length, updatedTimeData, allowanceRanges))
        }
    }
    logger.info("initial fixed time points:")
    for (p in res) logger.info("    $p")
    return res
}

private fun getEngineeringAllowanceRanges(edges: List<STDCMEdge>): List<EngineeringAllowanceRange> {
    var edgeStartOffset = Offset.zero<PhysicsPath>()
    val res = mutableListOf<EngineeringAllowanceRange>()
    for (edge in edges) {
        val allowance = edge.engineeringAllowance
        if (allowance != null) {
            val engineeringAllowanceLength = allowance.length
            val engineeringAllowanceBegin = edgeStartOffset - engineeringAllowanceLength
            val engineeringAllowanceEnd = edgeStartOffset

            val duration = allowance.extraDuration
            res.add(
                EngineeringAllowanceRange(
                    engineeringAllowanceBegin,
                    engineeringAllowanceEnd,
                    duration,
                )
            )
        }
        edgeStartOffset += edge.length.distance
    }
    return res
}

/**
 * Create a new time point to best avoid the conflict at the given location.
 *
 * If the point is in an engineering allowance range, we add a point at the end of that range. We
 * then try to add the point at the nearest edge transition. When trying to add a point at a
 * location that already has a point, we move down the priority list. (allowance range end -> edge
 * transition -> input offset). Once we have the offset, the time is fetched on the reference edges.
 *
 * The reason we round it to the start of the edge is because we don't have a reliable way to fetch
 * the time of a location on an edge, we can only make approximations. If that approximation falls
 * in an occupied block, we will fail to find a result. This means that the train sometimes start
 * speeding up too early. To fix it, we would need to make the approximation then move it if it
 * causes issues. It can be done but adds some complexity, it's out of scope of the current
 * refactoring.
 *
 * TODO: this current method doesn't seem to *always* converge to a valid solution, especially as
 *   the standalone sim may fail to compute short allowance ranges.
 */
private fun makeFixedPoint(
    fixedPoints: TreeSet<FixedTimePoint>,
    edges: List<STDCMEdge>,
    conflictOffset: Offset<PhysicsPath>,
    pathLength: Length<PhysicsPath>,
    updatedTimeData: TimeData,
    allowanceRanges: List<EngineeringAllowanceRange>,
    stopDuration: Double = 0.0,
): FixedTimePoint {
    var offset = roundOffset(edges, Offset.min(conflictOffset, pathLength), true)
    if (fixedPoints.any { it.offset == offset }) {
        offset = roundOffset(edges, conflictOffset, false)
    }
    if (fixedPoints.any { it.offset == offset } || offset.distance == 0.meters) {
        offset = conflictOffset
    }
    offset = Offset.min(offset, pathLength)
    var time = getTimeOnEdges(edges, offset, updatedTimeData)

    // getTimeOnEdges returns the "un-slowed" time inside an allowance range (the added delay only
    // appears at the carrier edge's start). We can't sum each containing range's contribution:
    // overlapping/nested ranges would double-count and produce non-monotonic times. Instead we
    // interpolate between the reliable cumulative times known at each range boundary.
    if (allowanceRanges.any { offset in it.from..it.to }) {
        time = interpolateAllowanceTime(edges, offset, updatedTimeData, allowanceRanges)
    }

    val nextConflictTime =
        edges
            .firstOrNull {
                // On transition, we want the second block (so it.length excluded from test)
                it.edgeOffsetFromPathOffset(offset) in Offset.zero<STDCMEdge>()..<it.length
            }
            ?.timeData
            ?.timeOfNextConflictAtLocation ?: Double.POSITIVE_INFINITY
    time = min(nextConflictTime, time)

    return FixedTimePoint(time, offset, if (stopDuration > 0) stopDuration else null)
}

/**
 * Estimates the time at an offset located inside one or more engineering allowance ranges.
 *
 * Each range ends at its carrier edge's start, whose exploration time already includes the absorbed
 * delay; those per-boundary times are monotonic in offset. We collect all range boundaries, attach
 * each one's exploration time (forced non-decreasing as a safety net), then linearly interpolate
 * the requested offset between its bracketing boundaries. This replaces summing each containing
 * range's linear ramp, which double-counted delay on overlapping/nested ranges.
 */
private fun interpolateAllowanceTime(
    edges: List<STDCMEdge>,
    offset: Offset<PhysicsPath>,
    updatedTimeData: TimeData,
    allowanceRanges: List<EngineeringAllowanceRange>,
): Double {
    val boundaries = sortedSetOf<Offset<PhysicsPath>>()
    for (range in allowanceRanges) {
        boundaries.add(range.from)
        boundaries.add(range.to)
    }
    val anchors = mutableListOf<Pair<Offset<PhysicsPath>, Double>>()
    var prevTime = Double.NEGATIVE_INFINITY
    for (b in boundaries) {
        val t = max(prevTime, getTimeOnEdges(edges, b, updatedTimeData))
        anchors.add(b to t)
        prevTime = t
    }
    val hiIndex = anchors.indexOfFirst { it.first >= offset }
    if (hiIndex < 0) return anchors.last().second
    if (hiIndex == 0) return anchors.first().second
    val (loOffset, loTime) = anchors[hiIndex - 1]
    val (hiOffset, hiTime) = anchors[hiIndex]
    if (hiOffset == loOffset) return hiTime
    val ratio = (offset - loOffset) / (hiOffset - loOffset)
    return loTime + (hiTime - loTime) * ratio
}

/**
 * Rounds the given offset to an edge transition. If `roundToEnd` is set, rounds to the end of the
 * edge containing the offset. Otherwise, rounds to the start.
 */
private fun roundOffset(
    edges: List<STDCMEdge>,
    offset: Offset<PhysicsPath>,
    roundToEnd: Boolean,
): Offset<PhysicsPath> {
    var prevEdgesLength = Offset<PhysicsPath>(0.meters)
    for (edge in edges) {
        if (offset <= prevEdgesLength + edge.length.distance) {
            return if (roundToEnd) prevEdgesLength + edge.length.distance else prevEdgesLength
        }
        prevEdgesLength += edge.length.distance
    }
    throw java.lang.RuntimeException("Couldn't find the offset on the given stdcm edges")
}

/**
 * Returns the time expected during the exploration at the given offset. The returned value is an
 * offset compared to the train departure time. On transition, the latest edge is used as reference,
 * as it may include allowances that aren't known on the previous edge. Unless the edge starts with
 * a stop, in which case we want the *arrival* time.
 */
private fun getTimeOnEdges(
    edges: List<STDCMEdge>,
    offset: Offset<PhysicsPath>,
    updatedTimeData: TimeData,
): Double {
    var remainingDistance = offset.distance
    for (edge in edges) {
        val atStop = edge.endAtStop && remainingDistance == edge.length.distance
        if (remainingDistance < edge.length.distance || atStop) {
            val absoluteTime =
                edge.getApproximateTimeAtLocation(Offset(remainingDistance), updatedTimeData)
            return absoluteTime - updatedTimeData.departureTime
        }
        remainingDistance -= edge.length.distance
    }
    // End of the last edge, this case is easier to handle separately
    val absoluteTime =
        edges.last().getApproximateTimeAtLocation(edges.last().length, updatedTimeData)
    return absoluteTime - updatedTimeData.departureTime
}

/**
 * Looks for the first detected conflict that would happen on the given envelope. If a conflict is
 * found, returns its offset. Otherwise, returns null.
 */
private fun findConflictOffsets(
    envelope: Envelope,
    blockAvailability: BlockAvailabilityInterface,
    edges: List<STDCMEdge>,
    updatedTimeData: TimeData,
): Offset<PhysicsPath>? {
    val explorer = getUpdatedExplorer(edges, envelope, updatedTimeData)
    val availability =
        blockAvailability.getAvailability(
            explorer,
            Offset.zero(),
            explorer.getSimulatedLength(),
            updatedTimeData.departureTime,
        )
    val offsetDistance =
        (availability as? BlockAvailabilityInterface.Unavailable)?.firstConflictOffset
            ?: return null
    return offsetDistance
}

/** Returns an infra explorer with envelope, with the given new envelope and updated time data */
private fun getUpdatedExplorer(
    edges: List<STDCMEdge>,
    envelope: Envelope,
    updatedTimeData: TimeData,
): InfraExplorerWithEnvelope {
    return edges.last().infraExplorer.withReplacedEnvelope(envelope).updateTimeData(updatedTimeData)
}

/**
 * Run a full simulation, with allowances configured to match the given fixed points. If isMareco is
 * set to true, the allowances follow the mareco distribution (more accurate but less reliable).
 */
fun runSimulationWithFixedPoints(
    envelopes: List<Envelope>,
    envelopeSimPath: PhysicsPath,
    rollingStocks: List<RollingStock>,
    fixedPoints: TreeSet<FixedTimePoint>,
    isMareco: Boolean,
    timeStep: Double,
    comfort: Comfort?,
): List<Envelope> {
    require(envelopes.size == rollingStocks.size)
    require(envelopes.none { it.beginSpeed != 0.0 })
    val finalEnvelopes = mutableListOf<Envelope>()
    var currentOffset = 0.meters
    var currentTime = 0.0
    for ((envelope, rollingStock) in envelopes.zip(rollingStocks)) {
        val subPhysicsPath =
            SubPhysicsPath(
                currentOffset.meters,
                currentOffset.meters + envelope.endPos,
                envelopeSimPath,
            )
        val context: EnvelopeSimContext = build(rollingStock, subPhysicsPath, timeStep, comfort)
        val shiftedFixedPoints =
            fixedPoints
                .map { it.copy(offset = it.offset - currentOffset, time = it.time - currentTime) }
                .filter { it.offset.meters <= envelope.endPos && it.offset.meters > 0 }
        val ranges = makeAllowanceRanges(envelope, shiftedFixedPoints)
        require(ranges.isNotEmpty()) {
            "There should be at least one allowance range, even if it's just a 0 allowance"
        }
        val allowance =
            if (isMareco)
                MarecoAllowance(
                    0.0,
                    envelope.endPos,
                    1.0, // Needs to be >0 to avoid problems when simulating low speeds
                    ranges,
                )
            else LinearAllowance(0.0, envelope.endPos, 0.0, ranges)
        val newEnvelope = allowance.apply(envelope, context)
        finalEnvelopes.add(newEnvelope)
        currentOffset += newEnvelope.endPos.meters
        currentTime +=
            newEnvelope.interpolateArrivalAt(newEnvelope.endPos) +
                shiftedFixedPoints.sumOf { it.stopTime ?: 0.0 }
    }
    return finalEnvelopes
}

/** Create the list of `AllowanceRange`, with the given fixed points */
private fun makeAllowanceRanges(
    envelope: Envelope,
    fixedPoints: Collection<FixedTimePoint>,
): List<AllowanceRange> {
    var transition = 0.0
    var transitionTime = 0.0
    var prevAddedTime = 0.0
    val res = ArrayList<AllowanceRange>()
    for (point in fixedPoints) {
        val baseTime =
            envelope.interpolateArrivalAtClamp(point.offset.meters) -
                envelope.interpolateDepartureFromClamp(transition)
        val pointArrivalTime = transitionTime + baseTime
        val neededDelay = max(0.0, point.time - pointArrivalTime - prevAddedTime)

        res.add(
            AllowanceRange(transition, point.offset.meters, AllowanceValue.FixedTime(neededDelay))
        )
        prevAddedTime += neededDelay

        transitionTime += baseTime + (point.stopTime ?: 0.0)
        transition = point.offset.meters
    }
    if (transition < envelope.endPos)
        res.add(AllowanceRange(transition, envelope.endPos, AllowanceValue.FixedTime(0.0)))

    return res
}

/**
 * This method handles the case where we find a conflict in post-processing that wasn't supposed to
 * be present according to what has been. This isn't supposed to happen, but when it does we want to
 * log as much data as possible. We can also fallback from mareco to linear margins.
 */
private fun handlePostProcessingConflict(
    graph: STDCMGraph,
    maxSpeedEnvelope: Envelope,
    edges: List<STDCMEdge>,
    standardAllowance: AllowanceValue?,
    envelopeSimPath: PhysicsPath,
    consistChanges: List<ConsistChange>,
    timeStep: Double,
    comfort: Comfort?,
    blockAvailability: BlockAvailabilityInterface,
    stops: List<TrainStop>,
    updatedTimeData: TimeData,
    fixedPoints: TreeSet<FixedTimePoint>,
    conflictOffset: Offset<PhysicsPath>,
    isMareco: Boolean,
    allowanceRanges: List<EngineeringAllowanceRange>,
    attempt: Int,
): FinalEnvelopeResult {
    if (graph.searchMetadata != null) {
        val stringDebugData by lazy {
            OutputSimDebugData.adapter.toJson(
                generatePartialDebugData(
                    graph.rawInfra,
                    graph.blockInfra,
                    edges,
                    graph.searchMetadata,
                    allowanceRanges,
                )
            )
        }
        val filename = System.getenv("STDCM_DEBUG_DATA_FILENAME")
        if (filename != null) {
            File(filename).writeText(stringDebugData)
        }
        graph.searchMetadata.s3Context?.writeSTDCMFile("failed_simulation_data.json") {
            stringDebugData
        }
    }

    postProcessingLogger.error(
        "Conflicts detected in post-processing, mismatch with the exploration data"
    )
    postProcessingLogger.error(
        "NOTE: look through the logs for allowance issues, they may cause mismatches."
    )
    val conflictTime = fixedPoints.first { it.offset == conflictOffset }.time
    postProcessingLogger.info(
        "    conflict happened at offset=$conflictOffset/${maxSpeedEnvelope.endPos.toInt()} " +
            "and t=${conflictTime.toInt()}/${updatedTimeData.timeSinceDeparture.toInt()}"
    )

    var remainingDistance = conflictOffset.distance
    for ((i, edge) in edges.withIndex()) {
        val atStop = edge.endAtStop && remainingDistance == edge.length.distance
        if (remainingDistance < edge.length.distance || atStop) {
            val updatedTimeAtConflict =
                edge.getApproximateTimeAtLocation(Offset(remainingDistance), updatedTimeData)
            val updatedExplorer = getUpdatedExplorer(edges, maxSpeedEnvelope, updatedTimeData)
            postProcessingLogger.info("    edge $i/${edges.size}: $edge")
            postProcessingLogger.info("        offset $remainingDistance/${edge.length}")
            postProcessingLogger.info("        original time data: ${edge.timeData}")
            postProcessingLogger.info("        updated time data: $updatedTimeData")
            postProcessingLogger.info(
                "        original explorer stops: ${edge.infraExplorerWithNewEnvelope.generateReachedTrainStops()}"
            )
            postProcessingLogger.info(
                "        updated explorer stops: ${updatedExplorer.generateReachedTrainStops()}"
            )
            postProcessingLogger.info(
                "        updated start time: ${edge.timeData.getUpdatedEarliestReachableTime(updatedTimeData)}"
            )
            postProcessingLogger.info(
                "        updated time at conflict location: $updatedTimeAtConflict"
            )
            break
        }
        remainingDistance -= edge.length.distance
    }

    if (attempt < 5) {
        postProcessingLogger.info(
            "attempt $attempt: retrying after adding traction to rolling stock..."
        )
        postProcessingLogger.info("(reset of fixed time points)")
        // First retry by removing mareco, then by increasing rolling stock traction
        val scaleFactor = if (isMareco) 1.0 else 1.2
        val newRollingStock =
            consistChanges.map { it.copy(rollingStock = it.rollingStock.scalePower(scaleFactor)) }
        return buildFinalEnvelope(
            graph,
            edges,
            standardAllowance,
            envelopeSimPath,
            newRollingStock,
            timeStep,
            comfort,
            blockAvailability,
            stops,
            updatedTimeData,
            isMareco = false,
            attempt = attempt + 1,
        )
    } else {
        throw RuntimeException(
            "Failed to compute a simulation that wouldn't cause conflicts: " +
                "mismatch between exploration and postprocessing (please open a bug report)"
        )
    }
}

fun makeMaxSpeedEnvelopes(
    trainPath: TrainPath,
    stops: List<TrainStop>,
    consistChanges: List<ConsistChange>,
    timeStep: Double,
    comfort: Comfort?,
    trainTag: String?,
    temporarySpeedLimitManager: TemporarySpeedLimitManager?,
    stopAtEnd: Boolean,
): List<Envelope> {
    var begin = Offset<PhysicsPath>(0.meters)
    val envelopes = mutableListOf<Envelope>()
    var initialSpeed = 0.0
    for ((index, consistChange) in consistChanges.withIndex()) {
        val rollingStock = consistChange.rollingStock
        val end = consistChange.end
        val subPath = trainPath.subPath(begin, end)
        val context = build(rollingStock, subPath, timeStep, comfort)
        val mrsp = computeMRSP(subPath, rollingStock, false, trainTag, temporarySpeedLimitManager)
        val stopInfos =
            stops
                .filter {
                    it.position.meters > begin.distance && it.position.meters <= end.distance
                }
                .map { SimStop(Offset(it.position.meters - begin.distance), it.receptionSignal) }
                .toMutableList()
        if (stopAtEnd && index == consistChanges.size - 1)
            stopInfos.add(SimStop(subPath.getLength(), SHORT_SLIP_STOP))
        val maxSpeedEnvelope = maxSpeedEnvelopeFrom(context, stopInfos, mrsp)
        val maxEffortEnvelope = maxEffortEnvelopeFrom(context, initialSpeed, maxSpeedEnvelope)
        envelopes.add(maxEffortEnvelope)
        initialSpeed = maxEffortEnvelope.endSpeed
        begin = end
    }
    return envelopes
}
