package fr.sncf.osrd.utils

import fr.sncf.osrd.utils.indexing.*
import kotlin.test.Test
import kotlin.test.assertEquals

class TestIndexes {
    interface O

    @Test
    fun testIndexList() {
        val mutList = MutableStaticIdxArray<O>(3) {
            i ->
            StaticIdx(i.toUInt() + 1u)
        }

        val iterationRes = MutableList<StaticIdx<O>>(0) { StaticIdx(0U) }
        mutList.iterator().forEach { i -> iterationRes.add(i) }

        assertEquals(mutList.size, iterationRes.size)
        assertEquals(mutList[0], iterationRes[0])
        assertEquals(mutList[1], iterationRes[1])
        assertEquals(mutList[2], iterationRes[2])
    }
}
