package fr.sncf.osrd.utils

/**
 * Wraps a Sequence in a way that allows several iterations. The initial sequence elements are only
 * generated at most once, still lazily. Dropping the first elements on a new iterations is
 * inexpensive.
 */
data class CacheableSequence<T>(
    val baseIterator: Iterator<T>,
    val cache: MutableList<T> = mutableListOf<T>(),
) : Sequence<T> {
    class CacheableIterator<T>(var sequence: CacheableSequence<T>) : Iterator<T> {
        var i = 0

        override fun hasNext(): Boolean {
            return i < sequence.cache.size || sequence.baseIterator.hasNext()
        }

        override fun next(): T {
            val res =
                if (i < sequence.cache.size) {
                    sequence.cache[i]
                } else {
                    val newValue = sequence.baseIterator.next()
                    sequence.cache.add(newValue)
                    newValue
                }
            i++
            return res
        }
    }

    override fun iterator(): Iterator<T> {
        return CacheableIterator(this)
    }
}

fun <T> Sequence<T>.cacheable(): CacheableSequence<T> {
    if (this is CacheableSequence) return this
    return CacheableSequence(iterator())
}
