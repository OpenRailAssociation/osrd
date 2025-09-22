package fr.sncf.osrd.utils

import com.google.common.collect.Range
import com.google.common.collect.RangeMap

// Some extension function to help with easy iterating over range maps

/** Iterates over the values in the map, in ascending order. */
val <K : Comparable<K>, V> RangeMap<K, V>.values: Iterable<V>
    get() = asMapOfRanges().values

/** Returns the ranges set in the map. */
val <K : Comparable<K>, V> RangeMap<K, V>.keys: Set<Range<K>>
    get() = asMapOfRanges().keys

/** Iterates over the entries in the map, in ascending order. */
val <K : Comparable<K>, V> RangeMap<K, V>.entries: Iterable<Map.Entry<Range<K>, V>>
    get() {
        val res = asMapOfRanges().entries
        // Sanity check, TODO: remove this
        val list = res.toList()
        for ((before, after) in list.dropLast(1) zip list.drop(1)) {
            assert(before.key.lowerEndpoint() <= after.key.lowerEndpoint())
        }
        return res
    }
