package fr.sncf.osrd.stdcm.graph

import com.google.common.collect.Comparators.min
import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.ImmutableRangeSet
import com.google.common.collect.Range
import com.google.common.collect.RangeMap
import com.google.common.collect.RangeSet
import com.google.common.collect.TreeRangeMap
import com.google.common.collect.TreeRangeSet
import fr.sncf.osrd.stdcm.infra_exploration.EdgeIdentifier
import fr.sncf.osrd.utils.units.Distance
import kotlin.Double.Companion.POSITIVE_INFINITY
import kotlin.math.max

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
 * times, but in ways that have been fully covered by previously seen nodes. For each location, we
 * keep track of two things:
 * 1. When have we *visited* this place? This considers the ranges that have been covered by
 *    previously seen nodes, possibly by shifting the departure time
 * 2. When could we reach this place, including engineering margins? This isn't just a "visited"
 *    flag as it would increase the path cost, but it can avoid a lot of redundant computations
 *
 * When testing for a time range, we only test the range that can be reached by delaying the
 * departure time. We consider it "already visited" when the whole range is either flagged as
 * visited, or the new cost value isn't lower than what could be obtained by adding engineering
 * margins.
 */
data class VisitedNodes(val minDelay: Double) {

    /** Data class representing a space location. Must be usable as map key. */
    data class Fingerprint(
        val identifier: EdgeIdentifier,
        val waypointIndex: Int,
        val startOffset: Distance
    )

    /** Parameters for either function, having a class avoids repetitions */
    data class Parameters(
        var fingerprint: Fingerprint?,
        val startTime: Double,
        val duration: Double,
        val maxMarginDuration: Double,
        val baseNodeCost: Double,
    )

    /**
     * Linear function with slope of 1. Used to represent the cost to reach a given time with margin
     */
    data class LinearFunction(private val y0: Double) : Comparable<LinearFunction> {
        fun apply(x: Double): Double = y0 + x

        override fun compareTo(other: LinearFunction): Int {
            return y0.compareTo(other.y0)
        }
    }

    /**
     * For each location, the time ranges that have been visited. We know they can always be
     * ignored.
     */
    private val visitedRangesPerLocation = mutableMapOf<Fingerprint, RangeSet<Double>>()

    /**
     * Time ranges that can be reached by adding margins. This isn't just "visited" as it would add
     * the margin duration to the cost function. The values represent the estimated cost of a path
     * that reach any given time of the range.
     */
    private val reachableRangesPerLocation =
        mutableMapOf<Fingerprint, RangeMap<Double, LinearFunction>>()

    /** Returns true if the input has already been visited */
    fun isVisited(
        parameters: Parameters,
    ): Boolean {
        val alreadyVisitedTimes =
            visitedRangesPerLocation[parameters.fingerprint!!] ?: ImmutableRangeSet.of()
        val alreadyReachableRanges =
            reachableRangesPerLocation[parameters.fingerprint!!]
                ?: ImmutableRangeMap.of(Range.all<Double>(), LinearFunction(POSITIVE_INFINITY))

        val visitingRange =
            Range.closed(parameters.startTime, parameters.startTime + parameters.duration)

        // List the ranges that are being explored, outside the previously visited ranges
        val rangesToCheck = TreeRangeSet.create<Double>()
        rangesToCheck.add(visitingRange)
        rangesToCheck.removeAll(alreadyVisitedTimes)

        // then check what's left against the reachable ranges
        for (range in rangesToCheck.asRanges()) {
            val alreadyReachableMap = alreadyReachableRanges.subRangeMap(range)
            for (entry in alreadyReachableMap.asMapOfRanges()) {
                if (entry.value.apply(entry.key.upperEndpoint()) > parameters.baseNodeCost)
                    return false
            }
        }
        return true
    }

    /** Marks the input as visited */
    fun markAsVisited(
        parameters: Parameters,
    ) {
        val visitedTimes =
            visitedRangesPerLocation.getOrPut(parameters.fingerprint!!) { TreeRangeSet.create() }

        // We still enforce a min duration for the visited range to avoid evaluating close trains
        // separately
        val endVisitedTime = parameters.startTime + max(parameters.duration, minDelay)
        val newRange = Range.closed(parameters.startTime, endVisitedTime)
        visitedTimes.add(newRange)

        if (parameters.maxMarginDuration > 0.0) {
            val reachableRanges =
                reachableRangesPerLocation.getOrPut(parameters.fingerprint!!) {
                    val map = TreeRangeMap.create<Double, LinearFunction>()
                    map.put(Range.all(), LinearFunction(POSITIVE_INFINITY))
                    map
                }
            val reachableRange =
                Range.closed(endVisitedTime, endVisitedTime + parameters.maxMarginDuration)
            val value = LinearFunction(parameters.baseNodeCost - endVisitedTime)
            reachableRanges.merge(reachableRange, value) { f, g -> min(f, g) }
        }
    }
}
