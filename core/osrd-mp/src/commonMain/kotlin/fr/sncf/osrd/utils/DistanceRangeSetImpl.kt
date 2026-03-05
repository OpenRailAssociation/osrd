package fr.sncf.osrd.utils

import fr.sncf.osrd.utils.units.Distance

class DistanceRangeSetImpl : DistanceRangeSet {

    val map = distanceRangeMapOf<Boolean>()

    override fun put(lower: Distance, upper: Distance) {
        map.put(lower, upper, true)
    }

    override fun remove(lower: Distance, upper: Distance) {
        map.put(lower, upper, false)
    }

    override fun asList(): List<DistanceRangeSet.RangeSetEntry> {
        return map.filter { entry -> entry.value }
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

    override fun contains(offset: Distance): Boolean {
        return map.get(offset) ?: false
    }

    override fun iterator(): Iterator<DistanceRangeSet.RangeSetEntry> {
        return asList().iterator()
    }

    // This declaration is needed for the extension methods in kt-osrd-utils
    companion object
}
