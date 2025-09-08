package fr.sncf.osrd.utils

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.Range
import com.google.common.collect.RangeMap
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.meters
import java.util.function.BiFunction

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
    fun putMany(entries: List<RangeMapEntry<T>>)

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
    fun <U> updateMapIntersection(update: DistanceRangeMap<U>, updateFunction: BiFunction<T, U, T>)

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
 * Merges all the given range maps, offsetting them by the given distances. The lists must be empty
 * or `maps` must be larger by one.
 */
fun <T> mergeDistanceRangeMaps(
    maps: List<DistanceRangeMap<T>>,
    distances: List<Distance>,
): DistanceRangeMap<T> {
    assert((maps.size - 1 == distances.size) || (maps.isEmpty() && distances.isEmpty()))

    val resEntries = ArrayList<DistanceRangeMap.RangeMapEntry<T>>()

    var previousDistance = 0.meters
    // Adding a last distance for convenience, it's not used.
    for ((map, distance) in maps zip distances + 0.meters) {
        for (entry in map) {
            resEntries.add(
                DistanceRangeMap.RangeMapEntry(
                    entry.lower + previousDistance,
                    entry.upper + previousDistance,
                    entry.value,
                )
            )
        }
        previousDistance += distance
    }

    // Build the whole map at once to avoid redundant computations.
    return distanceRangeMapOf(resEntries)
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

// TODO: Get rid of this function, by propagating DistanceRangeMap to the whole codebase
/**
 * Converts a DistanceRangeMap<T> into a legacy RangeMap<Double, T>. Distances are converted to
 * floats (m).
 */
fun <T> DistanceRangeMap<T>.toRangeMap(): RangeMap<Double, T> {
    val res = ImmutableRangeMap.builder<Double, T>()
    for (entry in this) {
        if (entry.value != null)
            res.put(Range.closedOpen(entry.lower.meters, entry.upper.meters), entry.value!!)
    }
    return res.build()
}
