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
 *
 * # Note to implementors
 *
 * [DistanceRangeMap.iterator] must return entries in ascending order.
 *
 * Like [List] implementations, [DistanceRangeMap] implementations must override [Any.toString],
 * [Any.equals] and [Any.hashCode] functions and provide implementations such that:
 * - [DistanceRangeMap.toString] should return a string containing string representation of the
 *   range entries in ascending order.
 * - [DistanceRangeMap.equals] should consider two maps equal if and only if they contain the same
 *   entries.
 * - [DistanceRangeMap.hashCode] should be computed as a combination of the entries' hash codes
 *   using the following algorithm: ```kotlin var hashCode: Int = 1 for (entry in
 *   this.sortedAscending()) hashCode = hashCode * 31 + entry.hashCode() ```
 */
interface DistanceRangeMap<T> : Iterable<DistanceRangeMap.RangeMapEntry<T>> {

    /** When iterating over the values of the map, this represents one range of constant value */
    data class RangeMapEntry<T>(val lower: Distance, val upper: Distance, val value: T)

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

    /**
     * Get the value at the given offset, if there is any. On exact transition offsets, the value
     * for the higher offset is used.
     */
    fun get(offset: Distance): T?

    /** Returns a deep copy of the map as a [MutableDistanceRangeMap] */
    fun toMutableDistanceRangeMap(): MutableDistanceRangeMap<T>

    /**
     * Returns a new [DistanceRangeMap] of the ranges between [lower] and [upper].
     *
     * Optionally, it shifts the ranges of the resulting map by [shift].
     */
    fun subMap(
        lower: Distance,
        upper: Distance,
        shift: Distance = Distance.ZERO,
    ): DistanceRangeMap<T>

    /** Returns true if there is no entry at all */
    fun isEmpty(): Boolean
}

fun <T> distanceRangeMapOf(
    vararg entries: DistanceRangeMap.RangeMapEntry<T>
): MutableDistanceRangeMap<T> {
    return MutableDistanceRangeMap(entries.asList())
}

fun <T> distanceRangeMapOf(
    entries: Sequence<DistanceRangeMap.RangeMapEntry<T>>
): MutableDistanceRangeMap<T> {
    return MutableDistanceRangeMap(entries.asIterable())
}

fun <T> distanceRangeMapOf(
    entries: Iterable<DistanceRangeMap.RangeMapEntry<T>>
): MutableDistanceRangeMap<T> {
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
