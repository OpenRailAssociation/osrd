package fr.sncf.osrd.utils

import com.google.common.collect.Range
import com.google.common.collect.RangeMap

// Some extension functions to help iterating over range maps

/** Iterates over the values in the map, in ascending order. */
val <K : Comparable<K>, V> RangeMap<K, V>.values: Iterable<V>
    get() = asMapOfRanges().values

/** Returns the ranges set in the map. */
val <K : Comparable<K>, V> RangeMap<K, V>.keys: Set<Range<K>>
    get() = asMapOfRanges().keys

/** Iterates over the entries in the map, in ascending order. */
val <K : Comparable<K>, V> RangeMap<K, V>.entries: Iterable<Map.Entry<Range<K>, V>>
    get() {
        return asMapOfRanges().entries
    }

/** Returns true if the range is a singleton (i.e. the range is of the form [a, a]). */
val <K : Comparable<K>> Range<K>.isSingleton: Boolean
    get() = lowerEndpoint() == upperEndpoint()
