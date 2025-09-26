package fr.sncf.osrd.utils

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.Range
import com.google.common.collect.RangeMap
import java.util.TreeMap
import java.util.function.BiFunction

/**
 * Experimental, mostly a POC to see if we can build the new incremental paths around this.
 *
 * Wrap a linked list of range maps into one larger range map, while following the generic
 * `RangeMap` interface. Operations that only require accessing the last element (or iterating in
 * reverse order) do so in a lazy way, only accessing the closest end of the linked list. As a
 * fallback, we build an actual `RangeMap` containing all data, and store it in a soft reference.
 */
data class IncrementalRangeMap<K : Comparable<K>, V>(
    // Shouldn't be extended in place (would mess with the caches)
    private val maps: AppendOnlyLinkedList<RangeMap<K, V>>,
    // Need to be computed during instantiation, for efficient indexing
    private val entriesCount: Int,
) : RangeMap<K, V> {

    // These attributes are very convenient but expensive to compute,
    // so they're lazily evaluated and kept private. We can make some public if relevant.

    // Converting it to a list avoids navigating the (non-local) linked list structure
    // (The list itself takes little extra memory, SoftLazy isn't required)
    private val mapList by lazy { maps.toList() }

    // Instantiates an actual `RangeMap`, merging all the underlying maps.
    // Quite expensive, but we can use it to define all methods from the interface.
    private val fullMap: RangeMap<K, V> by SoftLazy {
        val builder = ImmutableRangeMap.builder<K, V>()
        for (map in mapList) builder.putAll(map)
        builder.build()
    }

    // Defines a navigable (sorted) map of all (range -> value) entries
    private val fullNavigableMap by SoftLazy {
        val map = TreeMap<Range<K>, V>(Comparator.comparing { it.lowerEndpoint() })
        map.putAll(iterateEntriesBackwards())
        map
    }

    override fun get(key: K): V? {
        return getEntry(key)?.value
    }

    override fun getEntry(key: K): Map.Entry<Range<K>, V>? {
        val lastMap = maps.lastOrNull() ?: return null
        if (lastMap.span().contains(key)) return lastMap.getEntry(key)
        return fullMap.getEntry(key)
    }

    override fun span(): Range<K> {
        val firstMap = maps[0]
        val lastMap = maps.last()
        return Range.range(
            firstMap.span().lowerEndpoint(),
            firstMap.span().lowerBoundType(),
            lastMap.span().lowerEndpoint(),
            lastMap.span().lowerBoundType(),
        )
    }

    override fun put(range: Range<K>, value: V & Any) {
        throw UnsupportedOperationException("Append a new map instead")
    }

    override fun putCoalescing(range: Range<K>, value: V & Any) {
        throw UnsupportedOperationException("Append a new map instead")
    }

    override fun putAll(rangeMap: RangeMap<K, out V>) {
        throw UnsupportedOperationException("Append a new map instead")
    }

    override fun clear() {
        throw UnsupportedOperationException("Can't modify previously set values")
    }

    override fun remove(range: Range<K>) {
        throw UnsupportedOperationException("Can't modify previously set values")
    }

    override fun merge(
        range: Range<K>,
        value: V?,
        remappingFunction: BiFunction<in V, in V?, out V?>,
    ) {
        throw UnsupportedOperationException("Can't modify previously set values")
    }

    override fun asMapOfRanges(): Map<Range<K>, V> {
        return fullNavigableMap
    }

    override fun asDescendingMapOfRanges(): Map<Range<K>, V> {
        return fullNavigableMap.reversed()
    }

    override fun subRangeMap(range: Range<K>): RangeMap<K, V> {
        // Can be optimized if relevant
        return fullMap.subRangeMap(range)
    }

    fun iterateEntriesBackwards(): Sequence<Pair<Range<K>, V>> = sequence {
        val entriesNotCoalesced =
            maps.iterateBackwards().flatMap { it.asDescendingMapOfRanges().toList() }

        var lastEntry: Pair<Range<K>, V>? = null
        for (entry in entriesNotCoalesced) {
            if (lastEntry?.second == entry.second) {
                // We're iterating backwards so we extend identical ranges backwards as well
                assert(lastEntry.first.lowerEndpoint() == entry.first.upperEndpoint())
                lastEntry =
                    Pair(
                        Range.range(
                            entry.first.lowerEndpoint(),
                            entry.first.lowerBoundType(),
                            lastEntry.first.upperEndpoint(),
                            lastEntry.first.upperBoundType(),
                        ),
                        entry.second,
                    )
            } else {
                lastEntry?.let { yield(it) }
                lastEntry = entry
            }
        }
        lastEntry?.let { yield(it) }
    }

    data class IndexedEntry<K : Comparable<K>, V>(val index: Int, val key: Range<K>, val value: V)

    fun iterateIndexedEntriesBackwards(): Sequence<IndexedEntry<K, V>> = sequence {
        var nextIndex = entriesCount - 1
        for (entry in iterateEntriesBackwards()) {
            yield(IndexedEntry(nextIndex, entry.first, entry.second))
            nextIndex--
        }
        assert(nextIndex == -1)
    }

    fun getEntryAtIndex(index: Int): Pair<Range<K>, V> {
        val indexedEntry = iterateIndexedEntriesBackwards().first { it.index == index }
        return Pair(indexedEntry.key, indexedEntry.value)
    }

    fun cloneAndExtend(vararg newValues: RangeMap<K, V>): IncrementalRangeMap<K, V> {
        val mapCopy = maps.shallowCopy()
        val lastEntry = iterateEntriesBackwards().firstOrNull()
        mapCopy.addAll(newValues.toList())
        return IncrementalRangeMap(mapCopy, entriesCount + countNewEntries(newValues, lastEntry))
    }
}

fun <K : Comparable<K>, V> incrementalRangeMapOf(
    vararg values: RangeMap<K, V>
): IncrementalRangeMap<K, V> {
    val mapCopy = appendOnlyLinkedListOf<RangeMap<K, V>>()
    mapCopy.addAll(values.toList())
    return IncrementalRangeMap(mapCopy, countNewEntries(values, null))
}

private fun <K : Comparable<K>, V> countNewEntries(
    values: Array<out RangeMap<K, V>>,
    lastEntry: Pair<Range<K>, V>?,
): Int {
    var mutLastEntry = lastEntry
    var newEntryCount = 0
    for (newMap in values) {
        val newMapEntries = newMap.entries
        var newMapCount = newMap.entries.count()
        if (newMapCount == 0) continue
        val repeatedFirstEntry = mutLastEntry == newMapEntries.first()
        if (repeatedFirstEntry) newMapCount--
        newEntryCount += newMapCount
        val newMapLastEntry = newMapEntries.last()
        mutLastEntry = Pair(newMapLastEntry.key, newMapLastEntry.value)
    }
    return newEntryCount
}
