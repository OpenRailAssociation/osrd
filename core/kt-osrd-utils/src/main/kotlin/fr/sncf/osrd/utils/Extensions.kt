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
