package fr.sncf.osrd.utils

import fr.sncf.osrd.utils.units.Distance

interface DistanceRangeSet : Iterable<DistanceRangeSet.RangeSetEntry> {

    /** When iterating over the values of the set, this represents one range */
    data class RangeSetEntry(
        val lower: Distance,
        val upper: Distance,
    )

    /** Sets the value between the lower and upper distances */
    fun put(lower: Distance, upper: Distance)

    /** Removes the value between the lower and upper distances */
    fun remove(lower: Distance, upper: Distance)

    /** Returns a list of the entries in the map */
    fun asList(): List<RangeSetEntry>

    /** Lower bound of the entry with the smallest distance */
    fun lowerBound(): Distance

    /** Upper bound of the entry with the highest distance */
    fun upperBound(): Distance

    /** Removes all values outside the given range */
    fun truncate(beginOffset: Distance, endOffset: Distance)

    /** Shifts the positions by adding the given value */
    fun shiftPositions(offset: Distance)
}

fun distanceRangeSetOf(): DistanceRangeSet {
    return DistanceRangeSetImpl()
}
