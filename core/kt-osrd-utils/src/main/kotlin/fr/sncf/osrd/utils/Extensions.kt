package fr.sncf.osrd.utils

/** Removes consecutive duplicated values from a list. Keeps duplicates that aren't consecutive. */
fun <T> List<T>.withoutConsecutiveDuplicates(): List<T> {
    if (isEmpty()) return emptyList()
    val res = mutableListOf(first())
    for (x in dropSeq(1)) {
        if (res.last() != x) {
            res.add(x)
        }
    }
    return res
}

/**
 * Similar to `list.drop(n)`, but avoids copying the whole list. Returns a Sequence instead of a
 * list.
 */
fun <T> List<T>.dropSeq(count: Int): Sequence<T> {
    return asSequence().drop(count)
}
