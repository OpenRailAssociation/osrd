package fr.sncf.osrd.utils

import java.util.BitSet

/** Simple bloom filter implementation. */
class BloomFilter<T>(private val bitField: BitSet, private val nHash: Int) {

    /** Add a value to the set. */
    fun add(value: T) {
        var hash = value.hashCode()
        for (i in 0..nHash) {
            bitField.set(hash % bitField.size())
            hash = hash.hashCode()
        }
    }

    /**
     * Check whether a value can be present in the set. False positive are possible, false negative
     * are not.
     */
    fun mayContain(value: T): Boolean {
        var hash = value.hashCode()
        for (i in 0..nHash) {
            if (!bitField.get(hash % bitField.size())) return false
            hash = hash.hashCode()
        }
        return true
    }

    fun copy(): BloomFilter<T> {
        return BloomFilter(bitField.clone() as BitSet, nHash)
    }
}

fun <T> emptyBloomFilter(bitsetSize: Int = 2048, nHash: Int = 2): BloomFilter<T> {
    return BloomFilter(BitSet(bitsetSize), nHash)
}
