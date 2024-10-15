package fr.sncf.osrd.utils

/**
 * Append-only map implementation. The internal structure is a linked list. Used to store data on
 * diverging paths while minimizing copies. See also `AppendOnlyLinkedList`. On duplicates, the
 * previous value is effectively replaced, but it still takes some space in the list.
 */
class AppendOnlyMap<K, V>(
    private val list: AppendOnlyLinkedList<Pair<K, V>>,
    private val keyFilter: BloomFilter<K>,
) {
    /**
     * Returns the value associated with the key. O(n) in worst case, O(1) if the value is near the
     * end.
     */
    operator fun get(k: K): V? {
        return list.findLast { it.first == k }?.second
    }

    /** Add the given pair of values to the map. O(1). */
    operator fun set(k: K, v: V) {
        keyFilter.add(k)
        list.add(Pair(k, v))
    }

    /** Returns a copy of the map. The underlying structure is *not* copied. O(1). */
    fun shallowCopy(): AppendOnlyMap<K, V> {
        return AppendOnlyMap(list.shallowCopy(), keyFilter.copy())
    }

    /**
     * Returns true if the key is in the key set. O(n) in worst case, O(1) if the value is near the
     * end. Pre-filtered using a bloom filter.
     */
    fun containsKey(key: K): Boolean {
        if (!keyFilter.mayContain(key)) return false
        return list.findLast { it.first == key } != null
    }

    /**
     * Generates a "normal" map from the current instance values. Θ(n) once, but operations on the
     * resulting map should be O(1) (unlike operations on the `AppendOnlyMap` itself).
     */
    fun toMap(): Map<K, V> {
        return list.toList().toMap()
    }

    override fun toString(): String {
        return toMap().toString()
    }
}

/** Returns a new empty list */
fun <K, V> appendOnlyMapOf(): AppendOnlyMap<K, V> {
    return AppendOnlyMap(appendOnlyLinkedListOf(), emptyBloomFilter())
}
