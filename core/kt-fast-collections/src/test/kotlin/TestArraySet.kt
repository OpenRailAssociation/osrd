package fr.sncf.osrd.fast_collections

import kotlin.test.Test
import kotlin.test.assertTrue

class ArrayTestTest {
    @Test
    fun `test basic search`() {
        val arrayList = MutableIntArraySet(14)
        arrayList.add(1)
        arrayList.add(2)
        arrayList.add(3)
        arrayList.add(4)
        arrayList.add(5)
        arrayList.add(8)
        assertTrue(arrayList.contains(5))
    }
}
