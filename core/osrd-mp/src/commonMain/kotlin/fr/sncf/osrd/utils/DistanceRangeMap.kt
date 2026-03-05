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

    /** When iterating over the values of the map, this represents one range of constant value */
    data class RangeMapEntry<T>(val lower: Distance, val upper: Distance, val value: T)

    /** Sets the value between the lower and upper distances */
    fun put(lower: Distance, upper: Distance, value: T)

    /** Sets many values more efficiently than many calls to `put` */
    fun putMany(entries: Iterable<RangeMapEntry<T>>)

    /** Returns a list of the entries in the map */
    @Deprecated(
        message =
            "If you want to iterate on entries, DistanceRangeMap is already an Iterable. If you really want a list, use Iterable.toList"
    )
    fun asList(): List<RangeMapEntry<T>> = toList()

    /** Lower bound of the entry with the smallest distance */
    fun lowerBound(): Distance

    /** Upper bound of the entry with the highest distance */
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

    /** Returns a new DistanceRangeMap of the ranges between lower and upper */
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
    return MutableDistanceRangeMap(entries.asList())
}

fun <T> distanceRangeMapOf(
    entries: Sequence<DistanceRangeMap.RangeMapEntry<T>>
): DistanceRangeMap<T> {
    return MutableDistanceRangeMap(entries.asIterable())
}

fun <T> distanceRangeMapOf(
    entries: Iterable<DistanceRangeMap.RangeMapEntry<T>>
): DistanceRangeMap<T> {
    return MutableDistanceRangeMap(entries)
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
        val filteredRange = mapToFilter.subMap(range.lower, range.upper)
        res.putMany(filteredRange)
    }
    return res
}
