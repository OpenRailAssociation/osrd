package fr.sncf.osrd.stdcm.graph.visited_node_tracking

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.DirDetectorId
import fr.sncf.osrd.sim_infra.utils.getBlockEntry
import fr.sncf.osrd.sim_infra.utils.getBlockExit
import fr.sncf.osrd.stdcm.graph.TimeData
import fr.sncf.osrd.stdcm.graph.visited_node_tracking.VisitedNodes.Parameters
import fr.sncf.osrd.stdcm.infra_exploration.EdgeIdentifier
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.stdcm.infra_exploration.getRemainingBlocks
import fr.sncf.osrd.utils.CachedBlockMRSPBuilder
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.meters
import kotlin.math.min

/**
 * This class keeps track of which nodes have already been visited.
 *
 * This class doesn't handle nodes instances directly, because the filtering is made on a node with
 * some extra lookahead data.
 *
 * the `minDelay` value should be roughly *twice* the minimum time delay between two trains. If it's
 * larger than that, we may consider two scenarios as equal when they are separated by a scheduled
 * train. A smaller value would lead to increased computation time.
 *
 * There are two steps to determine if a node has been visited. The first is the location: have we
 * seen this physical place? This is defined by the `Fingerprint` class, and handles the block
 * location and lookahead. The second is the time: have we been at this location at a time that has
 * already been covered?
 *
 * The time check is where most complexity lies: we often pass by the same places at different
 * times, but in ways that have been fully covered by previously seen nodes. We have a range map of
 * "conditionally visited ranges". We may consider that a range is already visited if, for example,
 * we need to add more than 42 seconds of stop duration to reach it.
 *
 * Currently, there are 3 range types: unconditionally visited, visited if adding less than x
 * seconds of stop duration, and visited if adding less than x seconds of margin. *When we add a
 * criteria to chose one path over another, we likely need to add an extra visited range type*.
 * Otherwise, we may consider that a range is visited despite being better according to the new
 * criteria.
 */
data class VisitedNodes(
    val minDelay: Double,
    val infra: FullInfra? = null,
    val mrspBuilder: CachedBlockMRSPBuilder? = null,
) {

    /** Data class representing a space location. Must be usable as map key. */
    data class Fingerprint(
        val identifier: EdgeIdentifier,
        val waypointIndex: Int,
        val startOffset: Distance,
    )

    /**
     * Parameters for either function (is visited / mark as visited), having a class avoids
     * repetitions
     */
    data class Parameters(
        var fingerprint: Fingerprint?,
        val timeData: TimeData,
        val maxMarginDuration: Double,
        val remainingTimeEstimation: Double = 0.0,
        val explorer: InfraExplorer? = null, // nullable for tests
    ) {
        val nodeCost = timeData.totalRunningTime + remainingTimeEstimation

        fun withClippedMarginDuration(maxMarginDurationUpperBound: Double): Parameters {
            return copy(maxMarginDuration = min(maxMarginDurationUpperBound, maxMarginDuration))
        }
    }

    /** Any class that implements this interface may be added to the visited ranges. */
    private val visitedRangesPerLocation = mutableMapOf<Fingerprint, VisitedRangeMap>()

    // For any given block, keep track of the maximum number of steps that have been reached.
    // Any future path that has less passed steps at this block will be discarded.
    // The underlying assumption being, for a requested path "A -> B -> C":
    // for any point X, if there exists a path A -> B -> X, we won't accept a solution going
    // A -> X -> B -> C. It would likely involve loops around the X area.
    // This also avoids exploring the same solutions several times with less passed steps.
    private val minPassedStepsForBlock = mutableMapOf<BlockId, Int>()

    // For each detector, time ranges where it has been "reached" by a simulation,
    // i.e. an edge ends there with these given time ranges. Ignores the lookahead.
    // First key is the number of visited steps.
    // Note: nodes are located at the *start* of blocks, so it's handled by accessing
    // the start of the "current" block.
    private val visitedAtDetector = mutableMapOf<Int, MutableMap<DirDetectorId, VisitedRangeMap>>()

    /** Returns true if the input has already been visited */
    fun isVisited(parameters: Parameters): Boolean {
        if (
            (minPassedStepsForBlock[parameters.explorer?.getCurrentBlock()] ?: 0) >
                parameters.fingerprint!!.waypointIndex
        ) {
            // The block has already been seen with more passed steps
            return true
        }

        // Check if this node has a chance of opening new time ranges
        // at the very end of the lookahead section.
        if (parameters.explorer != null && infra != null) {
            val lastLookaheadBlock = parameters.explorer.getLookahead().lastOrNull()?.value
            if (lastLookaheadBlock != null) {
                val exitDet = infra.blockInfra.getBlockExit(infra.rawInfra, lastLookaheadBlock)
                val mapAtStepIndex = visitedAtDetector[parameters.fingerprint!!.waypointIndex]
                val mapAtDetector = mapAtStepIndex?.get(exitDet)

                val minTravelTime =
                    parameters.explorer.getRemainingBlocks().sumOf {
                        mrspBuilder!!.getBlockTime(it, null)
                    }

                // We compare it to a scenario with the minimum amount of added travel time, and
                // then an infinite amount of possible "engineering allowance" added time. We don't
                // actually know how much travel time we'd take to get there, nor if the extra
                // travel enables more allowances. This is very conservative, we could gain
                // performance by lowering the allowance time (but we'd miss out on some solutions).
                val newTimeData = parameters.timeData.withAddedTime(minTravelTime, null, null)
                val paramsWithLargerRange =
                    parameters.copy(
                        timeData = newTimeData,
                        maxMarginDuration = Double.POSITIVE_INFINITY,
                    )
                if (mapAtDetector != null && mapAtDetector.isVisited(paramsWithLargerRange)) {
                    return true
                }
            }
        }
        val visitedRanges = visitedRangesPerLocation[parameters.fingerprint] ?: return false
        return visitedRanges.isVisited(parameters.withClippedMarginDuration(0.0))
    }

    /** Marks the input as visited */
    fun markAsVisited(parameters: Parameters) {
        val fingerprint = parameters.fingerprint!!
        if (fingerprint.startOffset == 0.meters && parameters.explorer != null) {
            // The condition avoids discarding the first half of the block containing a step
            minPassedStepsForBlock[parameters.explorer.getCurrentBlock()] =
                fingerprint.waypointIndex
        }

        val newRangeMap = visitedRangeMapFromParameters(parameters, minDelay)
        val visitedRanges = visitedRangesPerLocation.getOrPut(fingerprint) { VisitedRangeMap() }
        visitedRanges.putAll(newRangeMap)

        // Mark the visited time range at the start of the current block
        if (parameters.explorer != null && infra != null && fingerprint.startOffset == 0.meters) {
            val block = parameters.explorer.getCurrentBlock()
            val mapAtStepIndex =
                visitedAtDetector.getOrPut(parameters.fingerprint!!.waypointIndex) {
                    mutableMapOf()
                }
            val blockEntry = infra.blockInfra.getBlockEntry(infra.rawInfra, block)
            val visitedRangesAtStartOfBlock =
                mapAtStepIndex.getOrPut(blockEntry) { VisitedRangeMap() }
            visitedRangesAtStartOfBlock.putAll(newRangeMap)
        }
    }
}

/**
 * Create a new VisitedRangeMap from the given `VisitedNodes.Parameters`. Describes all the time
 * ranges accessible from the current node.
 */
private fun visitedRangeMapFromParameters(
    parameters: Parameters,
    extraTimePadding: Double,
): VisitedRangeMap {
    val timeData = parameters.timeData
    val startTime = timeData.earliestReachableTime
    val maxDepartureTimeChange =
        min(
            timeData.maxDepartureDelayingWithoutConflict,
            timeData.stopTimeData.minOfOrNull { it.maxDepartureDelayBeforeStop }
                ?: Double.POSITIVE_INFINITY,
        )

    // We still add some padding to the end of each range and value, to avoid evaluating trains
    // that are close to one another separately (`minDelay`)
    val endRangeDepartureTimeChange = startTime + maxDepartureTimeChange + extraTimePadding
    val endRangeExtraStopTime =
        startTime + timeData.maxDepartureDelayingWithoutConflict + extraTimePadding
    val endRangeExtraTravelTime = endRangeExtraStopTime + parameters.maxMarginDuration

    val map = VisitedRangeMap()
    map.markAsVisited(
        startTime,
        endRangeDepartureTimeChange,
        endRangeExtraStopTime,
        endRangeExtraTravelTime,
        timeData.totalStopDuration,
        parameters.nodeCost,
    )
    return map
}

/** Utility function to map `VisitedNodes.Parameters` to `VisitedRangeMap.isVisited`. */
private fun VisitedRangeMap.isVisited(parameters: Parameters): Boolean {
    val newMap = visitedRangeMapFromParameters(parameters, 0.0)
    return isVisited(newMap)
}
