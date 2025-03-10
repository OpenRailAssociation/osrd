package fr.sncf.osrd.utils

import com.google.common.hash.BloomFilter

/**
 * Append-only set implementation. The internal structure is a linked list. Used to store data on
 * diverging paths while minimizing copies. See also `AppendOnlyLinkedList`.
 */
class AppendOnlySet<T>(
    private val list: AppendOnlyLinkedList<T>,
    private val keyFilter: BloomFilter<T>,
) {

    /** Add the given value to the set. O(1). */
    fun add(k: T) {
        keyFilter.put(k)
        list.add(k)
    }

    /** Returns a copy of the set. The underlying structure is *not* copied. O(1). */
    fun shallowCopy(): AppendOnlySet<T> {
        return AppendOnlySet(list.shallowCopy(), keyFilter.copy())
    }

    /**
     * Returns true if the value is in the set. O(n) in worst case, O(1) if the value is near the
     * end. Pre-filtered using a bloom filter.
     */
    fun contains(key: T): Boolean {
        if (!keyFilter.mightContain(key)) return false
        return list.findLast { it == key } != null
    }
}

/** Returns a new empty set */
inline fun <reified T> createAppendOnlySet(
    expectedInsertions: Int,
    falsePositiveRate: Double,
): AppendOnlySet<T> {
    return AppendOnlySet(
        appendOnlyLinkedListOf(),
        emptyBloomFilter(expectedInsertions, falsePositiveRate)
    )
}
