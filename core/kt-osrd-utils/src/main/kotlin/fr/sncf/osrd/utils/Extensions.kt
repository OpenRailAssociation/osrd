package fr.sncf.osrd.utils

import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf

fun <T> List<StaticIdx<T>>.toIdxList(): StaticIdxList<T> {
    val res = mutableStaticIdxArrayListOf<T>()
    res.addAll(this)
    return res
}
