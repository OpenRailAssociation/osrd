@file:PrimitiveWrapperCollections(
    wrapper = TestIndex::class,
    primitive = UInt::class,
    fromPrimitive = "TestIndex(%s)",
    toPrimitive = "%s.data",
    collections = ["Array", "ArrayList", "ArraySortedSet"],
)

@file:PrimitiveWrapperCollections(
    wrapper = TestGenericIndex::class,
    primitive = UInt::class,
    fromPrimitive = "TestGenericIndex(%s)",
    toPrimitive = "%s.data",
    collections = ["Array", "ArrayList", "ArraySortedSet"],
)

package fr.sncf.osrd.fast_collections

import kotlin.test.Test
import kotlin.test.assertEquals

@JvmInline
value class TestIndex(val data: UInt) : Comparable<TestIndex> {
    override fun compareTo(other: TestIndex): Int {
        return this.data.compareTo(other.data)
    }
}

@JvmInline
value class TestGenericIndex<T>(val data: UInt) : Comparable<TestGenericIndex<T>> {
    override fun compareTo(other: TestGenericIndex<T>): Int {
        return this.data.compareTo(other.data)
    }
}


class TestIndexes {
    @Test
    fun testCompare() {
        val testA = MutableTestIndexArrayList(8)
        val testB = MutableTestIndexArrayList(10)
        for (i in 0u until 6u) {
            testA.add(TestIndex(i))
            testB.add(TestIndex(i))
        }
        assertEquals(testA, testB)
    }
}
