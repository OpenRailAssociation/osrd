package fr.sncf.osrd.utils

import fr.sncf.osrd.utils.units.Distance

interface DistanceRangeSet : Iterable<DistanceRangeSet.RangeSetEntry> {

    /** When iterating over the values of the set, this represents one range */
    data class RangeSetEntry(val lower: Distance, val upper: Distance)

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

    /**
     * Returns true if the value is contained in the set. On range transition, returns the value to
     * the right.
     */
    fun contains(offset: Distance): Boolean
}

fun distanceRangeSetOf(): DistanceRangeSet {
    return DistanceRangeSetImpl()
}

/**
 * Create a range set from a range map, with values set where the predicate matches the map value.
 */
fun <T> DistanceRangeMap<T>.mapToRangeSet(f: (T) -> Boolean): DistanceRangeSet {
    val res = distanceRangeSetOf()
    for (entry in this) {
        if (f(entry.value)) {
            res.put(entry.lower, entry.upper)
        }
    }
    return res
}
