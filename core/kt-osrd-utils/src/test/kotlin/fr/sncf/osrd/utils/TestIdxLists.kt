package fr.sncf.osrd.utils

import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import kotlin.test.assertEquals
import org.junit.Test

class TestIdxLists {

    /**
     * We create a StaticIdxArrayList and an equivalent standard List, and check that the iterators
     * match.
     */
    @Test
    fun testForwardIterator() {
        val std = mutableListOf<StaticIdx<Int>>()
        val ours = mutableStaticIdxArrayListOf<Int>()

        for (i in 0..9) {
            std.add(StaticIdx(i.toUInt()))
            ours.add(StaticIdx(i.toUInt()))
        }

        val stdIt = std.listIterator()
        val oursIt = ours.listIterator()

        fun <T> test(f: (ListIterator<StaticIdx<Int>>) -> T) {
            val expected = f(stdIt)
            val actual = f(oursIt)
            assertEquals(expected, actual)
        }

        while (true) {
            test { it.nextIndex() }
            test { it.previousIndex() }
            test { it.hasNext() }
            test { it.hasPrevious() }
            if (!stdIt.hasNext()) break
            test { it.next() }
        }
    }

    /** Same test as above but with backward iterator */
    @Test
    fun testBackwardIterator() {
        val std = mutableListOf<StaticIdx<Int>>()
        val ours = mutableStaticIdxArrayListOf<Int>()

        for (i in 0..9) {
            std.add(StaticIdx(i.toUInt()))
            ours.add(StaticIdx(i.toUInt()))
        }

        val stdIt = std.listIterator(std.lastIndex)
        val oursIt = ours.listIterator(ours.lastIndex)

        fun <T> test(f: (ListIterator<StaticIdx<Int>>) -> T) {
            val expected = f(stdIt)
            val actual = f(oursIt)
            assertEquals(expected, actual)
        }

        while (true) {
            test { it.nextIndex() }
            test { it.previousIndex() }
            test { it.hasNext() }
            test { it.hasPrevious() }
            if (!stdIt.hasPrevious()) break
            test { it.previous() }
        }
    }

    /** Alternating directions */
    @Test
    fun testIteratorAlternatingDirections() {
        val std = mutableListOf<StaticIdx<Int>>()
        val ours = mutableStaticIdxArrayListOf<Int>()

        for (i in 0..9) {
            std.add(StaticIdx(i.toUInt()))
            ours.add(StaticIdx(i.toUInt()))
        }

        val stdIt = std.listIterator(5)
        val oursIt = ours.listIterator(5)

        fun <T> test(f: (ListIterator<StaticIdx<Int>>) -> T) {
            val expected = f(stdIt)
            val actual = f(oursIt)
            assertEquals(expected, actual)
        }

        test { it.previous() }
        test { it.next() }
        test { it.previous() }
        test { it.next() }
    }
}
