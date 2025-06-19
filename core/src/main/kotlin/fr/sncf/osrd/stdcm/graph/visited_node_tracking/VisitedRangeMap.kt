package fr.sncf.osrd.stdcm.graph.VisitedNodeTracking

import com.google.common.collect.Range
import com.google.common.collect.RangeMap
import com.google.common.collect.TreeRangeMap
import com.google.common.collect.TreeRangeSet
import fr.sncf.osrd.stdcm.graph.VisitedNodeTracking.VisitedNodes.Parameters

data class VisitedRangeMap(
    private val map: RangeMap<Double, ConditionallyVisitedRange> = TreeRangeMap.create()
) : RangeMap<Double, ConditionallyVisitedRange> by map {
    /**
     * Marks the given time ranges as visited in the map. Adds 3 ranges: visited with added
     * departure time, with extra stop duration, and with added travel time.
     */
    fun markAsVisited(
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
    fun isVisited(
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
