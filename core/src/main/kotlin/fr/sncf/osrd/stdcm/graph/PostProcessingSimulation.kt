package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.conflicts.TravelledPath
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.EnvelopeSimPath
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.*
import kotlin.math.max
import org.slf4j.Logger
import org.slf4j.LoggerFactory

val postProcessingLogger: Logger = LoggerFactory.getLogger("postprocessing-STDCM")

private data class FixedTimePoint(
    val time: Double,
    val offset: Offset<TravelledPath>,
    val stopTime: Double?
) : Comparable<FixedTimePoint> {
    override fun compareTo(other: FixedTimePoint): Int {
        return offset.compareTo(other.offset)
    }
}

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
    maxSpeedEnvelope: Envelope,
    edges: List<STDCMEdge>,
    standardAllowance: AllowanceValue?,
    envelopeSimPath: EnvelopeSimPath,
    rollingStock: RollingStock,
    timeStep: Double,
    comfort: Comfort?,
    blockAvailability: BlockAvailabilityInterface,
    stops: List<TrainStop>,
    updatedTimeData: TimeData,
    isMareco: Boolean = true,
): Envelope {
    val context = build(rollingStock, envelopeSimPath, timeStep, comfort)
    val fullInfraExplorer = edges.last().infraExplorerWithNewEnvelope

    val incrementalPath = fullInfraExplorer.getIncrementalPath()
    val pathLength =
        Length<TravelledPath>(
            Distance(millimeters = edges.sumOf { it.length.distance.millimeters })
        )
    assert(incrementalPath.pathComplete)
    val fixedPoints =
        initFixedPoints(
            edges,
            stops,
            pathLength,
            standardAllowance != null &&
                standardAllowance.getAllowanceTime(
                    maxSpeedEnvelope.totalTime,
                    pathLength.distance.meters
                ) > 0.0,
            updatedTimeData,
        )

    val maxIterations = edges.size * 2 // just to avoid infinite loops on bugs or edge cases
    for (i in 0 until maxIterations) {
        try {
            val newEnvelope =
                runSimulationWithFixedPoints(maxSpeedEnvelope, fixedPoints, context, isMareco)
            val conflictOffset =
                findConflictOffsets(
                    newEnvelope,
                    blockAvailability,
                    edges,
                    updatedTimeData,
                ) ?: return newEnvelope
            if (fixedPoints.any { it.offset == conflictOffset }) {
                // Error case: a conflict prevents us from finding a solution,
                // despite the exploration data identifying a valid opening.
                // This is not supposed to happen, but we can still fallback
                // linear allowance, and log as much info as we can
                return handlePostProcessingConflict(
                    graph,
                    maxSpeedEnvelope,
                    edges,
                    standardAllowance,
                    envelopeSimPath,
                    rollingStock,
                    timeStep,
                    comfort,
                    blockAvailability,
                    stops,
                    updatedTimeData,
                    fixedPoints,
                    conflictOffset,
                    isMareco,
                )
            }
            postProcessingLogger.info(
                "Conflict when running final stdcm simulation at offset {}, adding a fixed time point",
                conflictOffset
            )
            fixedPoints.add(
                makeFixedPoint(fixedPoints, edges, conflictOffset, pathLength, updatedTimeData)
            )
        } catch (e: OSRDError) {
            if (e.osrdErrorType == ErrorType.AllowanceConvergenceTooMuchTime) {
                // Mareco allowances must have a non-zero capacity speed limit,
                // which may cause "too much time" errors.
                // We can ignore this exception and move on to the linear allowance as fallback
                postProcessingLogger.warn(
                    "Can't slow down enough to match the given standard allowance"
                )
                break
            } else if (e.osrdErrorType == ErrorType.AllowanceConvergenceDiscontinuity) {
                // May be caused by this bug:
                // https://github.com/OpenRailAssociation/osrd/issues/9037
                // It's quite difficult to fix this issue for now, but we can
                // still fallback on linear allowance to have a result
                postProcessingLogger.warn("Discontinuity in mareco search space")
                break
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
            maxSpeedEnvelope,
            edges,
            standardAllowance,
            envelopeSimPath,
            rollingStock,
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
    length: Length<TravelledPath>,
    hasStandardAllowance: Boolean,
    updatedTimeData: TimeData,
): TreeSet<FixedTimePoint> {
    val res = TreeSet<FixedTimePoint>()
    var prevStopTime = 0.0
    for (stop in stops) {
        res.add(
            makeFixedPoint(
                res,
                edges,
                Offset(Distance.fromMeters(stop.position)),
                length,
                updatedTimeData,
                stop.duration,
            )
        )
        prevStopTime += stop.duration
    }
    if (hasStandardAllowance && res.none { it.offset == length })
        res.add(makeFixedPoint(res, edges, length, length, updatedTimeData, 0.0))
    return res
}

/**
 * Create a new fixed point at a given offset **rounded to an edge transition**. The reference time
 * is fetched on the given edges.
 *
 * The reason we round it to the start of the edge is because we don't have a reliable way to fetch
 * the time of a location on an edge, we can only make approximations. If that approximation falls
 * in an occupied block, we will fail to find a result. This means that the train sometimes start
 * speeding up too early. To fix it, we would need to make the approximation then move it if it
 * causes issues. It can be done but adds some complexity, it's out of scope of the current
 * refactoring.
 *
 * We first try to round the offset on the edge end, if there is already a fixed point there we use
 * the edge start instead. When a conflict happens in the middle of an edge, we *sometimes* need to
 * set both. If both are already set, we keep the conflict offset as it is.
 */
private fun makeFixedPoint(
    fixedPoints: TreeSet<FixedTimePoint>,
    edges: List<STDCMEdge>,
    conflictOffset: Offset<TravelledPath>,
    pathLength: Length<TravelledPath>,
    updatedTimeData: TimeData,
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
    return FixedTimePoint(
        getTimeOnEdges(edges, offset, updatedTimeData),
        offset,
        if (stopDuration > 0) stopDuration else null
    )
}

/**
 * Rounds the given offset to an edge transition. If `roundToEnd` is set, rounds to the end of the
 * edge containing the offset. Otherwise, rounds to the start.
 */
private fun roundOffset(
    edges: List<STDCMEdge>,
    offset: Offset<TravelledPath>,
    roundToEnd: Boolean
): Offset<TravelledPath> {
    var prevEdgesLength = Offset<TravelledPath>(0.meters)
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
    offset: Offset<TravelledPath>,
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
): Offset<TravelledPath>? {
    val startOffset = edges[0].envelopeStartOffset
    val endOffset =
        startOffset +
            Distance(
                millimeters =
                    edges.stream().mapToLong { edge -> edge.length.distance.millimeters }.sum()
            )
    val explorer = getUpdatedExplorer(edges, envelope, updatedTimeData)
    assert(
        TrainPhysicsIntegrator.arePositionsEqual(envelope.endPos, (endOffset - startOffset).meters)
    )
    val availability =
        blockAvailability.getAvailability(
            explorer,
            startOffset.cast(),
            endOffset.cast(),
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
    updatedTimeData: TimeData
): InfraExplorerWithEnvelope {
    return edges
        .last()
        .infraExplorer
        .withReplacedEnvelope(
            envelope,
        )
        .updateStopDurations(updatedTimeData)
}

/**
 * Run a full simulation, with allowances configured to match the given fixed points. If isMareco is
 * set to true, the allowances follow the mareco distribution (more accurate but less reliable).
 */
private fun runSimulationWithFixedPoints(
    envelope: Envelope,
    fixedPoints: TreeSet<FixedTimePoint>,
    context: EnvelopeSimContext,
    isMareco: Boolean
): Envelope {
    val ranges = makeAllowanceRanges(envelope, fixedPoints)
    if (ranges.isEmpty()) return envelope
    val allowance =
        if (isMareco)
            MarecoAllowance(
                0.0,
                envelope.endPos,
                1.0, // Needs to be >0 to avoid problems when simulating low speeds
                ranges
            )
        else LinearAllowance(0.0, envelope.endPos, 0.0, ranges)
    return allowance.apply(envelope, context)
}

/** Create the list of `AllowanceRange`, with the given fixed points */
private fun makeAllowanceRanges(
    envelope: Envelope,
    fixedPoints: TreeSet<FixedTimePoint>
): List<AllowanceRange> {
    var transition = 0.0
    var transitionTime = 0.0
    var prevAddedTime = 0.0
    val res = ArrayList<AllowanceRange>()
    for (point in fixedPoints) {
        val baseTime =
            envelope.interpolateArrivalAtClamp(point.offset.distance.meters) -
                envelope.interpolateDepartureFromClamp(transition)
        val pointArrivalTime = transitionTime + baseTime
        val neededDelay = max(0.0, point.time - pointArrivalTime - prevAddedTime)

        res.add(
            AllowanceRange(
                transition,
                point.offset.distance.meters,
                AllowanceValue.FixedTime(neededDelay)
            )
        )
        prevAddedTime += neededDelay

        transitionTime += baseTime + (point.stopTime ?: 0.0)
        transition = point.offset.distance.meters
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
    envelopeSimPath: EnvelopeSimPath,
    rollingStock: RollingStock,
    timeStep: Double,
    comfort: Comfort?,
    blockAvailability: BlockAvailabilityInterface,
    stops: List<TrainStop>,
    updatedTimeData: TimeData,
    fixedPoints: TreeSet<FixedTimePoint>,
    conflictOffset: Offset<TravelledPath>,
    isMareco: Boolean
): Envelope {
    postProcessingLogger.error(
        "Conflicts detected in post-processing, mismatch with the exploration data"
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
                "        original explorer stops: ${edge.infraExplorerWithNewEnvelope.getStops()}"
            )
            postProcessingLogger.info(
                "        updated explorer stops: ${updatedExplorer.getStops()}"
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

    if (isMareco) {
        postProcessingLogger.info(
            "The error happened with mareco allowances, try to fallback on linear allowances"
        )
        postProcessingLogger.info("(reset of fixed time points)")
        return buildFinalEnvelope(
            graph,
            maxSpeedEnvelope,
            edges,
            standardAllowance,
            envelopeSimPath,
            rollingStock,
            timeStep,
            comfort,
            blockAvailability,
            stops,
            updatedTimeData,
            false,
        )
    } else {
        throw RuntimeException(
            "Failed to compute a simulation that wouldn't cause conflicts: " +
                "mismatch between exploration and postprocessing (please open a bug report)"
        )
    }
}
