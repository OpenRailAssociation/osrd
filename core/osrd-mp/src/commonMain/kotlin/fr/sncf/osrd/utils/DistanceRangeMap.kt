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
 * infra data).
 *
 * # Interval semantics
 *
 * Ranges in a [DistanceRangeMap] are closed-open with the following exception: ranges whose upper
 * bound aren't any range's lower bound (i.e. ranges that are followed by empty intervals, or the
 * last range) are closed.
 *
 * For example, if a [DistanceRangeMap] has these ranges:
 *
 *        A          B            C            D
 *     [1;100[   [100;128]   [256;1000[   [1000;1234]
 *
 * Then ranges A and C are closed-open, and ranges B and D are closed.
 *
 * TODO simplify bound management to have [closed;open[ intervals only (and dig on the impact for
 * the ETCS simulator, which _should_ be acceptable)
 *
 * # Note to implementors
 *
 * [DistanceRangeMap.iterator] must return entries in ascending order.
 */
interface DistanceRangeMap<T> : Iterable<DistanceRangeMap.RangeMapEntry<T>> {

    /** When iterating over the values of the map, this represents one range of constant value */
    data class RangeMapEntry<T>(val lower: Distance, val upper: Distance, val value: T) {
        fun isEmpty(): Boolean = lower >= upper
    }

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
     * Get the value at the given offset, if there is any.
     *
     * See "Interval semantics" in the [DistanceRangeMap] doc-comment.
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

    /** Returns true if a value is defined on every interval */
    fun isContinuous(): Boolean

    /** Clear the map */
    fun clear()

    /**
     * Run the callback for each entry in the map, on (lower, upper, value). Similar to iterating
     * over entries, but without allocating a `RangeMapEntry` for each entry.
     */
    fun forEach(callback: (lower: Distance, upper: Distance, value: T) -> Unit)

    /** Same as [forEach], with early exit if the callback returns false. */
    fun forEachWhile(callback: (lower: Distance, upper: Distance, value: T) -> Boolean)

    /**
     * Returns whether all distances from 0 (included) and [length] (excluded) are mapped.
     *
     * If [length] is lower or equal to zero, then this method returns `true`.
     */
    fun fullyCovers(length: Distance): Boolean {
        var prevUpper: Distance? = null
        for (entry in this) {
            when {
                entry.upper <= Distance.ZERO -> continue
                prevUpper != null && prevUpper != entry.lower -> return false
                entry.upper >= length -> return true
            }
            prevUpper = entry.upper
        }
        return length <= Distance.ZERO
    }

    /**
     * Iterates on the ranges where `this` and [other] map to single values.
     *
     * # Example
     *
     * ```kotlin
     * val map1 = distanceRangeMapOf(
     *     RangeMapEntry(0, 5, "A"),
     *     RangeMapEntry(5, 9, "B"),
     * )
     * val map2 = distanceRangeMapOf(
     *     RangeMapEntry(0, 2, 420),
     *     RangeMapEntry(2, 9, 69),
     * )
     *
     * assertEquals(
     *     map1.commonRanges(map2).toList(),
     *     listOf(
     *         RangeMapEntry(0, 2, "A" to 420),
     *         RangeMapEntry(2, 5, "A" to 69),
     *         RangeMapEntry(5, 9, "B" to 69),
     *     ),
     * )
     * ```
     *
     * See `TestDistanceRangeMap` for more examples.
     *
     * # Throws
     *
     * Throws an exception if `this` maps a range [other] doesn't, and vice versa.
     */
    fun <U> commonRanges(other: DistanceRangeMap<U>): Sequence<RangeMapEntry<Pair<T, U>>> =
        commonRanges(other) { lower, upper, t, u -> RangeMapEntry(lower, upper, t to u) }

    /**
     * Overload where you're given the opportunity to avoid the allocation of the [RangeMapEntry]
     * and the [Pair] by using the [transform] argument.
     */
    fun <U, R> commonRanges(
        other: DistanceRangeMap<U>,
        transform: (lower: Distance, upper: Distance, T, U) -> R,
    ): Sequence<R> = sequence {
        val thisIt = this@DistanceRangeMap.iterator()
        val otherIt = other.iterator()

        var thisEntry =
            if (thisIt.hasNext()) {
                thisIt.next()
            } else {
                require(!otherIt.hasNext()) { "other has entries beyond this" }
                return@sequence
            }
        require(otherIt.hasNext()) { "this has entries beyond other" }
        var otherEntry = otherIt.next()

        while (true) {
            require(thisEntry.lower == otherEntry.lower)

            val lower = thisEntry.lower
            val upper = Distance.min(thisEntry.upper, otherEntry.upper)

            yield(transform(lower, upper, thisEntry.value, otherEntry.value))

            if (thisEntry.upper == upper) {
                if (!thisIt.hasNext()) {
                    require(otherEntry.upper == upper) {
                        "other's last map entry spans longer than this' last"
                    }
                    require(!otherIt.hasNext()) { "other has entries beyond this" }
                    return@sequence
                }
                thisEntry = thisIt.next()
            } else {
                thisEntry = thisEntry.copy(lower = upper)
            }

            if (otherEntry.upper == upper) {
                require(otherIt.hasNext()) { "this' last map entry spans longer than other's last" }
                otherEntry = otherIt.next()
            } else {
                otherEntry = otherEntry.copy(lower = upper)
            }
        }
    }
}

fun <T> distanceRangeMapOf(vararg entries: DistanceRangeMap.RangeMapEntry<T>): DistanceRangeMap<T> {
    return DistanceRangeMapImpl(entries.asIterable())
}

fun <T> distanceRangeMapOf(
    entries: Sequence<DistanceRangeMap.RangeMapEntry<T>>
): DistanceRangeMap<T> {
    return DistanceRangeMapImpl(entries.asIterable())
}

fun <T> distanceRangeMapOf(
    entries: Iterable<DistanceRangeMap.RangeMapEntry<T>>
): DistanceRangeMap<T> {
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
    filter.forEach { lower, upper, _ ->
        val filteredRange = mapToFilter.subMap(lower, upper)
        res.putMany(filteredRange)
    }
    return res
}
