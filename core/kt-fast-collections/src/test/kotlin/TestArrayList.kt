package fr.sncf.osrd.fast_collections

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class ArrayListTest {
    @Test
    fun `adding elements should make them accessible`() {
        val arrayList = MutableIntArrayList()
        assertTrue(arrayList.isEmpty())

        assertTrue(arrayList.add(1))
        assertTrue(arrayList.add(2))
        assertTrue(arrayList.add(3))

        assertEquals(3, arrayList.size)
        assertEquals(1, arrayList.get(0))
        assertEquals(2, arrayList.get(1))
        assertEquals(3, arrayList.get(2))
    }

    @Test
    fun `adding 2 elements should make them accessible`() {
        val arrayList = MutableIntArrayList()
        assertTrue(arrayList.isEmpty())

        arrayList.add(1, 2)

        assertEquals(2, arrayList.size)
        assertEquals(1, arrayList.get(0))
        assertEquals(2, arrayList.get(1))
    }

    @Test
    fun `adding 3 elements should make them accessible`() {
        val arrayList = MutableIntArrayList()
        assertTrue(arrayList.isEmpty())

        arrayList.add(1, 2, 3)

        assertEquals(3, arrayList.size)
        assertEquals(1, arrayList.get(0))
        assertEquals(2, arrayList.get(1))
        assertEquals(3, arrayList.get(2))
    }

    @Test
    fun `adding elements as Collection should make them accessible`() {
        val arrayList = MutableIntArrayList()
        assertTrue(arrayList.isEmpty())

        arrayList.addAll(elements = listOf(1, 2, 3))

        assertEquals(3, arrayList.size)
        assertEquals(1, arrayList.get(0))
        assertEquals(2, arrayList.get(1))
        assertEquals(3, arrayList.get(2))
    }

    @Test
    fun `adding elements as Iterable should make them accessible`() {
        val arrayList = MutableIntArrayList()
        assertTrue(arrayList.isEmpty())

        arrayList.addAll(iterable = listOf(1, 2, 3))

        assertEquals(3, arrayList.size)
        assertEquals(1, arrayList.get(0))
        assertEquals(2, arrayList.get(1))
        assertEquals(3, arrayList.get(2))
    }

    @Test
    fun `inserting element should make it accessible`() {
        val arrayList = MutableIntArrayList()
        assertTrue(arrayList.isEmpty())
        arrayList.add(1, 3)

        arrayList.insert(1, 2)

        assertEquals(3, arrayList.size)
        assertEquals(2, arrayList.get(1))
    }

    @Test
    fun `setting element should set its value`() {
        val arrayList = MutableIntArrayList()
        assertTrue(arrayList.isEmpty())

        arrayList.add(1, 2, 3)
        assertEquals(2, arrayList.get(1))
        arrayList.set(1, 4)

        assertEquals(3, arrayList.size)
        assertEquals(4, arrayList.get(1))
    }

    @Test
    fun `removing element should remove it`() {
        val arrayList = MutableIntArrayList()
        assertTrue(arrayList.isEmpty())

        arrayList.add(1, 2, 3)
        arrayList.remove(1)

        assertEquals(2, arrayList.size)
        assertEquals(3, arrayList.get(1))
    }

    @Test
    fun `toMutableArray should return a mutable array with the correct elements`() {
        val arrayList = MutableIntArrayList()
        arrayList.add(1, 2, 3)

        val mutableArray = arrayList.toMutableArray()
        assertEquals(3, mutableArray.size)
        assertEquals(1, mutableArray.get(0))
        assertEquals(2, mutableArray.get(1))
        assertEquals(3, mutableArray.get(2))

        mutableArray.set(1, 4)

        assertEquals(3, mutableArray.size)
        assertEquals(1, mutableArray.get(0))
        assertEquals(4, mutableArray.get(1))
        assertEquals(3, mutableArray.get(2))
    }

    @Test
    fun `toArray should return an array with the correct elements`() {
        val arrayList = MutableIntArrayList()
        arrayList.add(1, 2, 3)

        val array = arrayList.toArray()
        assertEquals(3, array.size)
        assertEquals(1, array.get(0))
        assertEquals(2, array.get(1))
        assertEquals(3, array.get(2))
    }

    @Test
    fun `cloning should return a new array with the same elements`() {
        val arrayList = MutableIntArrayList()
        arrayList.add(1, 2, 3)

        val clonedArray = arrayList.clone()
        assertEquals(3, clonedArray.size)
        assertEquals(1, clonedArray.get(0))
        assertEquals(2, clonedArray.get(1))
        assertEquals(3, clonedArray.get(2))
    }

    @Test
    fun `reversing should reverse the array`() {
        val arrayList = MutableIntArrayList()
        arrayList.add(1, 2, 3)

        val reversedArray = arrayList.reversed()

        assertEquals(3, reversedArray.size)
        assertEquals(3, reversedArray.get(0))
        assertEquals(2, reversedArray.get(1))
        assertEquals(1, reversedArray.get(2))
    }

    @Test
    fun `comparing to array with same elements should return 0`() {
        val arrayList1 = MutableIntArrayList()
        assertTrue(arrayList1.isEmpty())

        arrayList1.add(1, 2, 3)

        val arrayList2 = MutableIntArrayList()
        assertTrue(arrayList2.isEmpty())

        arrayList2.add(1, 2, 3)

        assertEquals(0, arrayList1.compareTo(arrayList2))
    }

    @Test
    fun `comparing to array with smaller size should return -1`() {
        val arrayList1 = MutableIntArrayList()
        assertTrue(arrayList1.isEmpty())

        arrayList1.add(1)

        val arrayList2 = MutableIntArrayList()
        assertTrue(arrayList2.isEmpty())

        arrayList2.add(1, 2, 3)

        assertEquals(-1, arrayList1.compareTo(arrayList2))
    }

    @Test
    fun `comparing to array with bigger size should return 1`() {
        val arrayList1 = MutableIntArrayList()
        assertTrue(arrayList1.isEmpty())

        arrayList1.add(1, 2, 3)

        val arrayList2 = MutableIntArrayList()
        assertTrue(arrayList2.isEmpty())

        arrayList2.add(1)

        assertEquals(1, arrayList1.compareTo(arrayList2))
    }

    @Test
    fun `comparing to array with different elements should return the comparison of the first difference`() {
        val arrayList1 = MutableIntArrayList()
        assertTrue(arrayList1.isEmpty())

        arrayList1.add(1, 2, 3)

        val arrayList2 = MutableIntArrayList()
        assertTrue(arrayList2.isEmpty())

        arrayList2.add(1, 7, 3)

        assertEquals(-1, arrayList1.compareTo(arrayList2))
    }

    @Test
    fun `comparing to array with different elements should return the comparison of the first difference bis`() {
        val arrayList1 = MutableIntArrayList()
        assertTrue(arrayList1.isEmpty())

        arrayList1.add(1, 2, 3)

        val arrayList2 = MutableIntArrayList()
        assertTrue(arrayList2.isEmpty())

        arrayList2.add(1, 0, 3)

        assertEquals(1, arrayList1.compareTo(arrayList2))
    }

    @Test
    fun `hashing should return the same hash for the same elements`() {
        val arrayList1 = MutableIntArrayList()
        assertTrue(arrayList1.isEmpty())

        arrayList1.add(1, 2, 3)

        val arrayList2 = MutableIntArrayList()
        assertTrue(arrayList2.isEmpty())

        arrayList2.add(1, 2, 3)

        assertEquals(arrayList1.hashCode(), arrayList2.hashCode())
    }

    @Test
    fun `hashing should return different hashes for different elements`() {
        val arrayList1 = MutableIntArrayList()
        assertTrue(arrayList1.isEmpty())

        arrayList1.add(1, 2, 3)

        val arrayList2 = MutableIntArrayList()
        assertTrue(arrayList2.isEmpty())

        arrayList2.add(1, 7, 3)

        assertNotEquals(arrayList1.hashCode(), arrayList2.hashCode())
    }

    @Test
    fun `hashing should return different hashes for different sizes`() {
        val arrayList1 = MutableIntArrayList()
        assertTrue(arrayList1.isEmpty())

        arrayList1.add(1, 2)

        val arrayList2 = MutableIntArrayList()
        assertTrue(arrayList2.isEmpty())

        arrayList2.add(1, 2, 3)

        assertNotEquals(arrayList1.hashCode(), arrayList2.hashCode())
    }

    @Test
    fun `equals should return true for the same elements`() {
        val arrayList1 = MutableIntArrayList()
        assertTrue(arrayList1.isEmpty())

        arrayList1.add(1, 2, 3)

        val arrayList2 = MutableIntArrayList()
        assertTrue(arrayList2.isEmpty())

        arrayList2.add(1, 2, 3)

        assertTrue(arrayList1.equals(arrayList2))
    }

    @Test
    fun `equals should return false for different elements`() {
        val arrayList1 = MutableIntArrayList()
        assertTrue(arrayList1.isEmpty())

        arrayList1.add(1, 2, 3)

        val arrayList2 = MutableIntArrayList()
        assertTrue(arrayList2.isEmpty())

        arrayList2.add(1, 7, 3)

        assertFalse(arrayList1.equals(arrayList2))
    }

    @Test
    fun `toString should return the correct string`() {
        val arrayList = MutableIntArrayList()
        assertTrue(arrayList.isEmpty())

        arrayList.add(1, 2, 3)

        assertEquals("[1, 2, 3]", arrayList.toString())
    }

    @Test
    fun `clearing should remove elements`() {
        val arrayList = MutableIntArrayList()

        assertTrue(arrayList.add(1))
        assertTrue(arrayList.add(2))
        assertTrue(arrayList.add(3))
        assertTrue(arrayList.isNotEmpty())
        assertEquals(3, arrayList.size)

        arrayList.clear()

        assertTrue(arrayList.isEmpty())
        assertEquals(0, arrayList.size)
    }

    @Test
    fun `iterator should iterate over all elements and not beyond`() {
        val arrayList = MutableIntArrayList()
        assertTrue(arrayList.add(1))
        assertTrue(arrayList.add(2))
        assertTrue(arrayList.add(3))

        val iterator = arrayList.iterator()

        assertEquals(1, iterator.next())
        assertTrue(iterator.hasNext())
        assertEquals(2, iterator.next())
        assertTrue(iterator.hasNext())
        assertEquals(3, iterator.next())
        assertFalse(iterator.hasNext())
    }

    @Test
    fun `lists with same elements and same order should be equal`() {
        val arrayList1 = MutableIntArrayList()
        assertTrue(arrayList1.add(1))
        assertTrue(arrayList1.add(2))
        assertTrue(arrayList1.add(3))
        val arrayList2 = MutableIntArrayList()
        assertTrue(arrayList2.add(1))
        assertTrue(arrayList2.add(2))
        assertTrue(arrayList2.add(3))

        assertEquals(arrayList1, arrayList2)
    }

    @Test
    fun `lists with same elements and different order should be not equal`() {
        val arrayList1 = MutableIntArrayList()
        assertTrue(arrayList1.add(2))
        assertTrue(arrayList1.add(3))
        assertTrue(arrayList1.add(1))
        val arrayList2 = MutableIntArrayList()
        assertTrue(arrayList2.add(1))
        assertTrue(arrayList2.add(2))
        assertTrue(arrayList2.add(3))

        assertNotEquals(arrayList1, arrayList2)
    }
}
