package fr.sncf.osrd.stdcm.graph.visited_node_tracking

import com.google.common.collect.Range
import com.google.common.collect.RangeMap
import com.google.common.collect.TreeRangeMap

/**
 * This class maps duration ranges to their "visited" values. Some ranges are considered visited if
 * we add travel time or stop duration compared to their initial costs. See `VisitedRange.kt` for a
 * detailed description and comparison logic. This map lets us compare each range to test if it
 * opens new ranges, or old ranges but at a lower cost.
 */
data class VisitedRangeMap(
    private val map: RangeMap<Double, VisitedRange> = TreeRangeMap.create()
) : RangeMap<Double, VisitedRange> by map {
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
        fun putRange(start: Double, end: Double, value: VisitedRange) {
            if (start < end) {
                val range = Range.closedOpen(start, end)
                map.merge(range, value) { a, b -> a?.mergeWith(b, range) ?: b }
            }
        }

        // Visited with just departure time change, this is always considered as "visited".
        // (The end of all ranges depends on conflicting occupancy along the path)
        map.put(
            Range.closed(startTime, endRangeDepartureTimeChange),
            VisitedWithDepartureTimeChange(nodeCost, totalStopDuration),
        )

        // Visited with extra stop duration, starting from the end of the previous range
        putRange(
            endRangeDepartureTimeChange,
            endRangeExtraStopTime,
            VisitedWithAddedStopTime(
                LinearFunction(totalStopDuration - endRangeDepartureTimeChange),
                nodeCost,
            ),
        )
        // Visited with extra margins, starting from the end of the previous range
        putRange(
            endRangeExtraStopTime,
            endRangeExtraTravelTime,
            VisitedWithAddedTravelTime(
                LinearFunction(nodeCost - endRangeExtraStopTime),
                totalStopDuration,
            ),
        )
    }

    /**
     * Returns true if the map already contains visited ranges for all new ranges from the given
     * parameters.
     */
    fun isVisited(newValues: VisitedRangeMap): Boolean {
        if (newValues.map.asMapOfRanges().isEmpty()) return true

        val visitingRange = newValues.span()
        val subMap = map.subRangeMap(visitingRange)
        val subMapRanges = subMap.asMapOfRanges()
        if (subMapRanges.isEmpty()) return false

        // Check boundaries first
        val subMapSpan = subMap.span()
        if (visitingRange != subMapSpan) return false

        var expectedNextRangeStart = visitingRange.lowerEndpoint()
        for (visitedEntry in subMapRanges) {
            val rangeStart = visitedEntry.key.lowerEndpoint()
            assert(rangeStart >= expectedNextRangeStart)
            if (expectedNextRangeStart < rangeStart) {
                // Ranges aren't contiguous: uncovered area
                return false
            }
            for (newEntry in newValues.subRangeMap(visitedEntry.key).asMapOfRanges()) {
                // Value isn't visited: we can early return "false"
                if (!visitedEntry.value.isVisited(newEntry.key, newEntry.value)) return false
            }
            expectedNextRangeStart = visitedEntry.key.upperEndpoint()
        }
        return true
    }
}
