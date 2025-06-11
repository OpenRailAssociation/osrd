package fr.sncf.osrd.stdcm.graph

import com.google.common.collect.Range
import com.google.common.collect.RangeMap
import com.google.common.collect.TreeRangeMap
import com.google.common.collect.TreeRangeSet
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.areTimesEqual
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.DirDetectorId
import fr.sncf.osrd.sim_infra.utils.getBlockEntry
import fr.sncf.osrd.sim_infra.utils.getBlockExit
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
    val mrspBuilder: CachedBlockMRSPBuilder? = null
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
    }

    /** Any class that implements this interface may be added to the visited ranges. */
    private sealed interface ConditionallyVisitedRange {
        /** Is the given (sub)range covered by `this`? */
        fun isVisited(
            range: Range<Double>,
            parameters: Parameters,
        ): Boolean

        /**
         * Returns the range that is most likely to define elements as "already visited". Used to
         * merge overlapping ranges in the range map.
         */
        fun mergeWith(other: ConditionallyVisitedRange?): ConditionallyVisitedRange
    }

    /**
     * The given range is already visited by changing departure time. Such ranges are *always*
     * already visited.
     */
    private data object VisitedWithDepartureTimeChange : ConditionallyVisitedRange {
        override fun isVisited(
            range: Range<Double>,
            parameters: Parameters,
        ): Boolean {
            // If the other option were better, it would have been visited first
            return true
        }

        override fun mergeWith(other: ConditionallyVisitedRange?): ConditionallyVisitedRange {
            return this
        }
    }

    /**
     * The given range is already visited by adding stop durations. A candidate is already visited
     * if their cost is higher or equal, or for equal cost if they add at least as much stop time as
     * this.
     */
    private data class VisitedWithAddedStopTime(
        // the time t is visited at f(t) seconds of total stop duration
        private val visitedWithStopTime: LinearFunction,
        // If the cost is higher, we don't even consider stop time
        private val baseCost: Double,
    ) : ConditionallyVisitedRange {
        override fun isVisited(
            range: Range<Double>,
            parameters: Parameters,
        ): Boolean {
            if (parameters.nodeCost > baseCost) return true
            val stopDurationForVisited = visitedWithStopTime.apply(range.lowerEndpoint())
            return stopDurationForVisited <= parameters.timeData.totalStopDuration
        }

        override fun mergeWith(other: ConditionallyVisitedRange?): ConditionallyVisitedRange {
            if (other is VisitedWithDepartureTimeChange) return other
            if (other is VisitedWithAddedStopTime) {
                if (!areTimesEqual(baseCost, other.baseCost))
                    return if (baseCost < other.baseCost) this else other
                return if (visitedWithStopTime < other.visitedWithStopTime) this else other
            }
            return this
        }
    }

    /**
     * The given range is already visited by adding margins. A candidate is already visited if their
     * cost is higher or equal (accounting for any extra travel time).
     */
    private data class VisitedWithAddedTravelTime(
        // the time t is visited at f(t) seconds of total running time duration
        private val visitedWithTravelTime: LinearFunction,
    ) : ConditionallyVisitedRange {
        override fun isVisited(
            range: Range<Double>,
            parameters: Parameters,
        ): Boolean {
            val runningTimeForVisited = visitedWithTravelTime.apply(range.upperEndpoint())
            return runningTimeForVisited <= parameters.nodeCost
        }

        override fun mergeWith(other: ConditionallyVisitedRange?): ConditionallyVisitedRange {
            if (other is VisitedWithAddedTravelTime) {
                return if (visitedWithTravelTime < other.visitedWithTravelTime) this else other
            }
            return other ?: this
        }
    }

    private val visitedRangesPerLocation =
        mutableMapOf<Fingerprint, RangeMap<Double, ConditionallyVisitedRange>>()

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
    private val visitedAtDetector =
        mutableMapOf<Int, MutableMap<DirDetectorId, RangeMap<Double, ConditionallyVisitedRange>>>()

    /** Returns true if the input has already been visited */
    fun isVisited(
        parameters: Parameters,
    ): Boolean {
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
            val lastLookaheadBlock = parameters.explorer.getLookahead().lastOrNull()
            if (lastLookaheadBlock != null) {
                val exitDet = infra.blockInfra.getBlockExit(infra.rawInfra, lastLookaheadBlock)
                val mapAtStepIndex = visitedAtDetector[parameters.fingerprint!!.waypointIndex]
                val mapAtDetector = mapAtStepIndex?.get(exitDet)

                val minTravelTime =
                    parameters.explorer.getRemainingBlocks().sumOf {
                        mrspBuilder!!.getBlockTime(it, null)
                    }
                // We only check after adding the fastest travel time, and then add some extra
                // margin at the end (in case engineering allowances are impossible there).
                // TODO: we should compare possible "engineering allowances" in `isMapVisited`,
                // with a large max allowance value here.
                // The current margin (travel time / 2) is a heuristic. Lowering it has a very large
                // impact on the performance gain, but may block valid solutions when engineering
                // allowances are impossible.
                val newTimeData =
                    parameters.timeData
                        .withAddedTime(minTravelTime, null, null)
                        .copy(
                            maxDepartureDelayingWithoutConflict =
                                parameters.timeData.maxDepartureDelayingWithoutConflict +
                                    (minTravelTime / 2),
                        )

                if (
                    mapAtDetector != null &&
                        isMapVisited(mapAtDetector, parameters.copy(timeData = newTimeData))
                ) {
                    return true
                }
            }
        }
        val visitedRanges = visitedRangesPerLocation[parameters.fingerprint] ?: return false
        return isMapVisited(visitedRanges, parameters)
    }

    /** Marks the input as visited */
    fun markAsVisited(
        parameters: Parameters,
    ) {
        val fingerprint = parameters.fingerprint!!
        if (fingerprint.startOffset == 0.meters && parameters.explorer != null) {
            // The condition avoids discarding the first half of the block containing a step
            minPassedStepsForBlock[parameters.explorer.getCurrentBlock()] =
                fingerprint.waypointIndex
        }
        val visitedRanges = visitedRangesPerLocation.getOrPut(fingerprint) { TreeRangeMap.create() }

        val timeData = parameters.timeData
        val startTime = timeData.earliestReachableTime
        val maxDepartureTimeChange =
            min(
                timeData.maxDepartureDelayingWithoutConflict,
                timeData.stopTimeData.minOfOrNull { it.maxDepartureDelayBeforeStop }
                    ?: Double.POSITIVE_INFINITY
            )

        // We still add some padding to the end of each range and value, to avoid evaluating trains
        // that are close to one another separately (`minDelay`)
        val endRangeDepartureTimeChange = startTime + maxDepartureTimeChange + minDelay
        val endRangeExtraStopTime =
            startTime + timeData.maxDepartureDelayingWithoutConflict + minDelay
        val endRangeExtraTravelTime = endRangeExtraStopTime + parameters.maxMarginDuration

        markAsVisited(
            visitedRanges,
            startTime,
            endRangeDepartureTimeChange,
            endRangeExtraStopTime,
            endRangeExtraTravelTime,
            timeData.totalStopDuration,
            parameters.nodeCost,
        )

        // Mark the visited time range at the start of the current block
        if (parameters.explorer != null && infra != null && fingerprint.startOffset == 0.meters) {
            val block = parameters.explorer.getCurrentBlock()
            val mapAtStepIndex =
                visitedAtDetector.getOrPut(parameters.fingerprint!!.waypointIndex) {
                    mutableMapOf()
                }
            val visitedRangesAtStartOfBlock =
                mapAtStepIndex.getOrPut(
                    infra.blockInfra.getBlockEntry(
                        infra.rawInfra,
                        block,
                    )
                ) {
                    TreeRangeMap.create()
                }
            markAsVisited(
                visitedRangesAtStartOfBlock,
                startTime,
                endRangeDepartureTimeChange,
                endRangeExtraStopTime,
                endRangeExtraTravelTime,
                timeData.totalStopDuration,
                parameters.nodeCost,
            )
        }
    }

    /**
     * Marks the given time ranges as visited in the map. Adds 3 ranges: visited with added
     * departure time, with extra stop duration, and with added travel time.
     */
    private fun markAsVisited(
        map: RangeMap<Double, ConditionallyVisitedRange>,
        startTime: Double,
        endRangeDepartureTimeChange: Double,
        endRangeExtraStopTime: Double,
        endRangeExtraTravelTime: Double,
        totalStopDuration: Double,
        nodeCost: Double,
    ) {
        fun putRange(start: Double, end: Double, value: ConditionallyVisitedRange) {
            if (start < end) {
                val range = Range.closedOpen(start, end)
                map.merge(range, value) { a, b -> a.mergeWith(b) }
            }
        }

        // Visited with just departure time change, this is always considered as "visited".
        // (The end of all ranges depends on conflicting occupancy along the path)
        putRange(
            startTime,
            endRangeDepartureTimeChange,
            VisitedWithDepartureTimeChange,
        )
        // Visited with extra stop duration, starting from the end of the previous range
        putRange(
            endRangeDepartureTimeChange,
            endRangeExtraStopTime,
            VisitedWithAddedStopTime(
                LinearFunction(totalStopDuration - endRangeDepartureTimeChange),
                nodeCost,
            )
        )
        // Visited with extra margins, starting from the end of the previous range
        putRange(
            endRangeExtraStopTime,
            endRangeExtraTravelTime,
            VisitedWithAddedTravelTime(LinearFunction(nodeCost - endRangeExtraStopTime))
        )
    }

    /**
     * Returns true if the map already contains visited ranges for all new ranges from the given
     * parameters.
     */
    private fun isMapVisited(
        map: RangeMap<Double, ConditionallyVisitedRange>,
        parameters: Parameters,
    ): Boolean {
        val timeData = parameters.timeData

        val visitingRange =
            Range.closedOpen(
                timeData.earliestReachableTime,
                timeData.earliestReachableTime + timeData.maxDepartureDelayingWithoutConflict
            )
        if (visitingRange.isEmpty) {
            // Special case for empty range, `subRangeMap` returns an empty list
            val value = map.get(timeData.earliestReachableTime) ?: return false
            return value.isVisited(visitingRange, parameters)
        }
        val subMap = map.subRangeMap(visitingRange)

        // Keep track of any range that isn't covered by the map
        val uncovered = TreeRangeSet.create<Double>()
        uncovered.add(visitingRange)
        for (entry in subMap.asMapOfRanges()) {
            uncovered.remove(entry.key)
            // Value isn't visited: we can early return "false"
            if (!entry.value.isVisited(entry.key, parameters)) return false
        }
        // If any area is left uncovered, we still return "false"
        return uncovered.isEmpty
    }
}

/** Linear function with slope of 1. Used to represent the cost to reach a given time with margin */
private data class LinearFunction(private val y0: Double) : Comparable<LinearFunction> {
    fun apply(x: Double): Double = y0 + x

    override fun compareTo(other: LinearFunction): Int {
        return y0.compareTo(other.y0)
    }
}
