package fr.sncf.osrd.utils

import fr.sncf.osrd.utils.units.Distance

/**
 * DistanceRangeMap allows to store values over intervals (e.g. elevation on sections of a track)
 * and query them. The default value is null.
 *
 * This is similar to guava's `RangeMap<Distance, T>`. There are tradeoffs with guava maps, detailed
 * in the issue https://github.com/OpenRailAssociation/osrd/issues/12828. To summarize here:
 * `DistanceRangeMap` is significantly more memory efficient, but it's a little slower than guava
 * maps. Ours don't have proper open/closed range semantics, and we cannot support zero-length
 * intervals.
 *
 * `DistanceRangeMap` should be used when memory footprint is a concern (in particular to store
 * infra data), and only when precise interval semantics aren't necessary.
 */
interface DistanceRangeMap<T> : Iterable<DistanceRangeMap.RangeMapEntry<T>> {

    /** One range of constant value */
    data class RangeMapEntry<T>(
        /** The lower bound of the range. Always included. */
        val lower: Distance,
        /** The lower bound of the range. Always excluded. */
        val upper: Distance,
        val value: T,
    ) {
        fun isEmpty(): Boolean = lower >= upper
    }

    /**
     * Sets the value between the [lower] and [upper] distances.
     *
     * [lower] is always included and [upper] is always excluded. If you want to exclude [lower] or
     * include [upper], use [Distance.nextUp] or [Distance.nextDown].
     *
     * If the range between [lower] and [upper] is empty, this method has no effect.
     */
    fun put(lower: Distance, upper: Distance, value: T)

    /** Sets many values more efficiently than many calls to `put` */
    fun putMany(entries: List<RangeMapEntry<T>>)

    /** Returns a list of the entries in the map */
    fun asList(): List<RangeMapEntry<T>>

    /**
     * Lower bound of the entry with the smallest distance.
     *
     * This method throws an exception when called on an empty map. Otherwise, because lower bounds
     * are always excluded, `get(lowerBound())` will always be non-null.
     */
    fun lowerBound(): Distance

    /**
     * Upper bound of the entry with the highest distance
     *
     * This method throws an exception when called on an empty map. Otherwise, because upper bounds
     * are always excluded, `get(upperBound())` will always be null.
     */
    fun upperBound(): Distance

    /** Removes all values outside the given range */
    fun truncate(beginOffset: Distance, endOffset: Distance)

    /**
     * Shifts the positions by adding the given value. Map is changed inplace, but still returned
     * for call chains.
     */
    fun shiftPositions(offset: Distance): DistanceRangeMap<T>

    /**
     * Get the value at the given offset, if there is any. On exact transition offsets, the value
     * for the higher offset is used.
     */
    fun get(offset: Distance): T?

    /** Returns a deep copy of the map */
    fun clone(): DistanceRangeMap<T>

    /**
     * Returns a new [DistanceRangeMap] where only the ranges between [lower] (included) and [upper]
     * (excluded) are kept.
     */
    fun subMap(lower: Distance, upper: Distance): DistanceRangeMap<T>

    /**
     * Updates the map with another one, using a merge function to fuse the values of intersecting
     * ranges. Doesn't keep any range from update where there is no intersection.
     */
    fun <U> updateMapIntersection(update: DistanceRangeMap<U>, updateFunction: (T, U) -> T)

    /**
     * Updates the map with another one, using a merge function to fuse the values of intersecting
     * ranges. Calls default on the values of the ranges from update where there is no intersection.
     */
    fun updateMap(
        update: DistanceRangeMap<T>,
        updateFunction: (T, T) -> T,
        default: (T) -> T = { it },
    )

    /** Returns true if there is no entry at all */
    fun isEmpty(): Boolean

    /** Clear the map */
    fun clear()
}

fun <T> distanceRangeMapOf(vararg entries: DistanceRangeMap.RangeMapEntry<T>): DistanceRangeMap<T> {
    return DistanceRangeMapImpl(entries.asList())
}

fun <T> distanceRangeMapOf(entries: List<DistanceRangeMap.RangeMapEntry<T>>): DistanceRangeMap<T> {
    return DistanceRangeMapImpl(entries)
}

/**
 * Filters the 'mapToFilter' map, keeping only ranges also present in 'filter' map (values from
 * 'filter' map are not considered)
 */
fun <T, R> filterIntersection(
    mapToFilter: DistanceRangeMap<T>,
    filter: DistanceRangeMap<R>,
): DistanceRangeMap<T> {
    val res = distanceRangeMapOf<T>()
    for (range in filter) {
        val filteredRange = mapToFilter.clone()
        filteredRange.truncate(range.lower, range.upper)
        res.putMany(filteredRange.asList())
    }
    return res
}
