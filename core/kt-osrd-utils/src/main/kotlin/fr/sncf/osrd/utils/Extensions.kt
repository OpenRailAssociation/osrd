package fr.sncf.osrd.utils

/** Removes consecutive duplicated values from a list. Keeps duplicates that aren't consecutive. */
fun <T> List<T>.withoutConsecutiveDuplicates(): List<T> {
    val res = mutableListOf<T>()
    var last: T? = null
    for (x in this) {
        if (last != x) {
            res.add(x)
            last = x
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
