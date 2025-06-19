package fr.sncf.osrd.stdcm.graph.VisitedNodeTracking

import com.google.common.collect.Range
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator
import fr.sncf.osrd.stdcm.graph.VisitedNodeTracking.VisitedNodes.Parameters

/**
 * This interface is used to express a time range that's considered already visited under some
 * condition. For example the range can be reached by adding at most $x seconds of travel time.
 */
sealed interface ConditionallyVisitedRange {
    /** Is the given (sub)range covered by `this`? */
    fun isVisited(
        range: Range<Double>,
        parameters: Parameters,
    ): Boolean

    /**
     * Returns the range that is most likely to define elements as "already visited". Used to merge
     * overlapping ranges in the range map.
     */
    fun mergeWith(other: ConditionallyVisitedRange?): ConditionallyVisitedRange
}

/**
 * The given range is already visited by changing departure time. Such ranges are *always* already
 * visited.
 */
data object VisitedWithDepartureTimeChange : ConditionallyVisitedRange {
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
 * The given range is already visited by adding stop durations. A candidate is already visited if
 * their cost is higher or equal, or for equal cost if they add at least as much stop time as this.
 */
data class VisitedWithAddedStopTime(
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
            if (!TrainPhysicsIntegrator.areTimesEqual(baseCost, other.baseCost))
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
data class VisitedWithAddedTravelTime(
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

/** Linear function with slope of 1. Used to represent the cost to reach a given time with margin */
data class LinearFunction(private val y0: Double) : Comparable<LinearFunction> {
    fun apply(x: Double): Double = y0 + x

    override fun compareTo(other: LinearFunction): Int {
        return y0.compareTo(other.y0)
    }
}
