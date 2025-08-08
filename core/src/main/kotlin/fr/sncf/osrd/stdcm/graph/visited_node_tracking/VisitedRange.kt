package fr.sncf.osrd.stdcm.graph.visited_node_tracking

import com.google.common.collect.Range
import fr.sncf.osrd.utils.areTimesEqual

/**
 * This interface is used to express a time range that's considered already visited under some
 * condition. For example the range can be reached by adding at most $x seconds of travel time.
 */
abstract class VisitedRange {
    /** Is the given (sub)range covered by `this`? */
    fun isVisited(timeRange: Range<Double>, visitingRange: VisitedRange): Boolean {
        val thisLowest = getLowestCostOnRange(timeRange)
        val otherLowest = visitingRange.getLowestCostOnRange(timeRange)
        val thisHighest = getHighestCostOnRange(timeRange)
        val otherHighest = visitingRange.getHighestCostOnRange(timeRange)
        return thisLowest <= otherLowest && thisHighest <= otherHighest
    }

    /**
     * Returns the range that is most likely to define elements as "already visited". Used to merge
     * overlapping ranges in the range map.
     */
    fun mergeWith(other: VisitedRange?, timeRange: Range<Double>): VisitedRange {
        if (other == null) return this
        return sequenceOf(this, other).minBy { it.getLowestCostOnRange(timeRange) }
    }

    /** The method to be defined in each subclass. Evaluated the detailed cost at the given time. */
    protected abstract fun evaluateAtTime(time: Double): DetailedCostAtTime

    /** Returns the lowest cost on the given time range. */
    private fun getLowestCostOnRange(timeRange: Range<Double>): DetailedCostAtTime {
        return evaluateAtTime(timeRange.lowerEndpoint())
    }

    /** Returns the lowest cost on the given time range. */
    private fun getHighestCostOnRange(timeRange: Range<Double>): DetailedCostAtTime {
        return evaluateAtTime(timeRange.upperEndpoint())
    }

    /**
     * Details the full "cost" to reach a given time. As there are several variables to be
     * considered with a strict hierarchy, we need to keep track of several values. Instances can be
     * compared to one another.
     */
    protected data class DetailedCostAtTime(
        val bestTravelTimeEstimation: Double, // f-value, current travel time + heuristic
        val totalStopDuration: Double,
    ) : Comparable<DetailedCostAtTime> {
        override fun compareTo(other: DetailedCostAtTime): Int {
            if (!areTimesEqual(bestTravelTimeEstimation, other.bestTravelTimeEstimation)) {
                return bestTravelTimeEstimation.compareTo(other.bestTravelTimeEstimation)
            }
            return totalStopDuration.compareTo(other.totalStopDuration)
        }
    }
}

/**
 * The given range is already visited by changing departure time. Such ranges are *always* already
 * visited.
 */
data class VisitedWithDepartureTimeChange(
    private val baseCost: Double,
    private val stopTime: Double,
) : VisitedRange() {
    override fun evaluateAtTime(time: Double): DetailedCostAtTime {
        return DetailedCostAtTime(baseCost, stopTime)
    }
}

/**
 * The given range is already visited by adding stop durations. A candidate is already visited if
 * their cost is higher or equal, or for equal cost if they add at least as much stop time as this.
 */
data class VisitedWithAddedStopTime(
    // the time t is visited at f(t) seconds of total stop duration
    private val visitedWithStopTime: LinearFunction,
    // If the cost is higher, we don't even consider stop time
    private val baseCost: Double,
) : VisitedRange() {
    override fun evaluateAtTime(time: Double): DetailedCostAtTime {
        return DetailedCostAtTime(baseCost, visitedWithStopTime.apply(time))
    }
}

/**
 * The given range is already visited by adding margins. A candidate is already visited if their
 * cost is higher or equal (accounting for any extra travel time).
 */
data class VisitedWithAddedTravelTime(
    // the time t is visited at f(t) seconds of total running time duration
    private val visitedWithTravelTime: LinearFunction,
    private val stopTime: Double,
) : VisitedRange() {
    override fun evaluateAtTime(time: Double): DetailedCostAtTime {
        return DetailedCostAtTime(visitedWithTravelTime.apply(time), stopTime)
    }
}

/** Linear function with slope of 1. Used to represent the cost to reach a given time with margin */
data class LinearFunction(private val y0: Double) : Comparable<LinearFunction> {
    fun apply(x: Double): Double = y0 + x

    override fun compareTo(other: LinearFunction): Int {
        return y0.compareTo(other.y0)
    }
}
