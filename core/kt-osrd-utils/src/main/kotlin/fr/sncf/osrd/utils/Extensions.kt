package fr.sncf.osrd.utils

import fr.sncf.osrd.utils.indexing.*

fun <T> List<StaticIdx<T>>.toIdxList(): StaticIdxList<T> {
    val res = mutableStaticIdxArrayListOf<T>()
    res.addAll(this)
    return res
}

fun <T> List<DirStaticIdx<T>>.toIdxList(): DirStaticIdxList<T> {
    val res = mutableDirStaticIdxArrayListOf<T>()
    res.addAll(this)
    return res
}

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
