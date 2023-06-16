package fr.sncf.osrd.utils;

import fr.sncf.osrd.utils.units.Distance

interface DistanceRangeMap<T> : Iterable<DistanceRangeMap.RangeMapEntry<T>> {

    /** When iterating over the values of the map, this represents one range of constant value */
    data class RangeMapEntry<T>(
        @get:JvmName("getLower")
        val lower: Distance,
        @get:JvmName("getUpper")
        val upper: Distance,
        @get:JvmName("getValue")
        val value: T,
    )

    /** Sets the value between the lower and upper distances */
    fun put(lower: Distance, upper: Distance, value: T)

    /** Returns a list of the entries in the map */
    fun asList(): List<RangeMapEntry<T>>

    /** Lower bound of the entry with the smallest distance */
    fun lowerBound(): Distance

    /** Upper bound of the entry with the highest distance */
    fun upperBound(): Distance

    /** Removes all values outside the given range */
    fun truncate(beginOffset: Distance, endOffset: Distance)

    /** Shifts the positions by adding the given value */
    fun shiftPositions(offset: Distance)

    /** Get the value at the given offset, if there is any.
     * On exact transition offsets, the value for the higher offset is used. */
    fun get(offset: Distance): T?
}

fun <T> distanceRangeMapOf(): DistanceRangeMap<T> {
    return DistanceRangeMapImpl()
}
