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

    @Test
    fun testIndexSet() {
        val set = mutableStaticIdxArraySetOf<Int>()

        set.add(StaticIdx(42U))
        set.add(StaticIdx(43U))
        set.add(StaticIdx(44U))
        set.add(StaticIdx(45U))
        set.add(StaticIdx(46U))

        set.add(StaticIdx(42U))
        set.add(StaticIdx(43U))
        set.add(StaticIdx(44U))


        val values = mutableSetOf<UInt>()
        for (v in set)
            values.add(v.index)
        assertEquals(
            setOf(42U, 43U, 44U, 45U, 46U),
            values
        )
    }
}
