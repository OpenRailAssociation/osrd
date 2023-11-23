package fr.sncf.osrd.fast_collections


import kotlin.test.Test
import kotlin.test.assertEquals


class ArrayListTest {
    @Test
    fun `adding elements should make them accessible`() {
        val arrayList = MutableIntArrayList()
        assert(arrayList.isEmpty())

        assertEquals(true, arrayList.add(1))
        assertEquals(true, arrayList.add(2))
        assertEquals(true, arrayList.add(3))

        assertEquals(3, arrayList.size)
        assertEquals(1, arrayList.get(0))
        assertEquals(2, arrayList.get(1))
        assertEquals(3, arrayList.get(2))
    }

    @Test
    fun `clearing should remove elements`() {
        val arrayList = MutableIntArrayList()

        assertEquals(true, arrayList.add(1))
        assertEquals(true, arrayList.add(2))
        assertEquals(true, arrayList.add(3))
        assert(arrayList.isNotEmpty())
        assertEquals(3, arrayList.size)

        arrayList.clear()
        
        assert(arrayList.isEmpty())
        assertEquals(0, arrayList.size)
    }

    // TODO: add more tests
}
