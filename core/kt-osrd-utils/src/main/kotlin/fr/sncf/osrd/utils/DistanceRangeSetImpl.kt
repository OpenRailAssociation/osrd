package fr.sncf.osrd.utils

import com.google.common.collect.RangeSet
import fr.sncf.osrd.utils.units.Distance

class DistanceRangeSetImpl: DistanceRangeSet {

    val map = distanceRangeMapOf<Boolean>()

    override fun put(lower: Distance, upper: Distance) {
        map.put(lower, upper, true)
    }

    override fun remove(lower: Distance, upper: Distance) {
        map.put(lower, upper, false)
    }

    override fun asList(): List<DistanceRangeSet.RangeSetEntry> {
        return map
            .filter { entry -> entry.value }
            .map { entry -> DistanceRangeSet.RangeSetEntry(entry.lower, entry.upper) }
    }

    override fun lowerBound(): Distance {
        return first().lower
    }

    override fun upperBound(): Distance {
        return last().upper
    }

    override fun truncate(beginOffset: Distance, endOffset: Distance) {
        map.truncate(beginOffset, endOffset)
    }

    override fun shiftPositions(offset: Distance) {
        map.shiftPositions(offset)
    }

    override fun iterator(): Iterator<DistanceRangeSet.RangeSetEntry> {
        return asList().iterator()
    }

    companion object {
        fun from(set: RangeSet<Double>): DistanceRangeSet {
            val res = distanceRangeSetOf()
            for (entry in set.asRanges())
                res.put(
                    Distance.fromMeters(entry.lowerEndpoint()),
                    Distance.fromMeters(entry.upperEndpoint()),
                )
            return res
        }
    }
}