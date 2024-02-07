package fr.sncf.osrd.fast_collections

import kotlin.test.Test
import kotlin.test.assertEquals

class RingBufferTest {
    @Test
    fun `adding elements to the front of the deque should make them accessible at the front`() {
        val deque = MutableIntRingBuffer()
        assertEquals(0, deque.addFront(1))
        assertEquals(-1, deque.addFront(2))
        assertEquals(-2, deque.addFront(3))
        assertEquals(1, deque[0])
        assertEquals(2, deque[-1])
        assertEquals(3, deque[-2])
    }

    @Test
    fun `adding elements to the back of the deque should make them accessible at the back`() {
        val deque = MutableIntRingBuffer()
        assertEquals(0, deque.addBack(1))
        assertEquals(1, deque.addBack(2))
        assertEquals(2, deque.addBack(3))
        assertEquals(1, deque[0])
        assertEquals(2, deque[1])
        assertEquals(3, deque[2])
    }

    @Test
    fun `adding elements to both ends of the deque should make them accessible in the correct order`() {
        val deque = MutableIntRingBuffer()
        assertEquals(0, deque.addFront(1))
        assertEquals(1, deque.addBack(2))
        assertEquals(-1, deque.addFront(3))
        assertEquals(2, deque.addBack(4))
        assertEquals(3, deque[-1])
        assertEquals(1, deque[0])
        assertEquals(2, deque[1])
        assertEquals(4, deque[2])
    }

    @Test
    fun `removing elements from the front of the deque should make the next element accessible at the front`() {
        val deque = MutableIntRingBuffer()
        assertEquals(0, deque.addFront(1))
        assertEquals(-1, deque.addFront(2))
        assertEquals(-2, deque.addFront(3))
        deque.removeFront()
        assertEquals(-2, deque.addFront(4))
        deque.removeFront()
        assertEquals(2, deque[-1])
        deque.removeFront()
        assertEquals(1, deque[0])
    }

    @Test
    fun `removing elements from the back of the deque should make the next element accessible at the back`() {
        val deque = MutableIntRingBuffer()
        assertEquals(0, deque.addBack(1))
        assertEquals(1, deque.addBack(2))
        assertEquals(2, deque.addBack(3))
        deque.removeBack()
        assertEquals(2, deque[1])
        deque.removeBack()
        assertEquals(1, deque[0])
    }

    @Test
    fun `removing elements from both ends of the deque should make the next elements accessible in the correct order`() {
        val deque = MutableIntRingBuffer()
        assertEquals(0, deque.addFront(1))
        assertEquals(1, deque.addBack(2))
        assertEquals(-1, deque.addFront(3))
        assertEquals(2, deque.addBack(4))
        deque.removeFront()
        assertEquals(1, deque[0])
        deque.removeBack()
        assertEquals(2, deque[1])
        deque.removeFront()
        assertEquals(2, deque[1])
    }

    @Test
    fun `the deque should be iterable`() {
        val deque = MutableIntRingBuffer()
        assertEquals(0, deque.addFront(1))
        assertEquals(1, deque.addBack(2))
        assertEquals(-1, deque.addFront(3))
        assertEquals(2, deque.addBack(4))
        assertEquals(listOf(3, 1, 2, 4), deque.toList())
    }

    @Test
    fun `the deque should be able to grow at the back`() {
        val deque = MutableIntRingBuffer()
        assertEquals(0, deque.addFront(1))
        assertEquals(1, deque.addBack(2))
        assertEquals(-1, deque.addFront(3))
        assertEquals(2, deque.addBack(4))
        assertEquals(3, deque.addBack(5))
        assertEquals(listOf(3, 1, 2, 4, 5), deque.toList())
    }

    @Test
    fun `the deque should be able to grow at the front`() {
        val deque = MutableIntRingBuffer()
        assertEquals(0, deque.addFront(1))
        assertEquals(1, deque.addBack(2))
        assertEquals(-1, deque.addFront(3))
        assertEquals(2, deque.addBack(4))
        assertEquals(-2, deque.addFront(5))
        assertEquals(listOf(5, 3, 1, 2, 4), deque.toList())
    }

    @Test
    fun `test removeFrontUntil`() {
        val deque = MutableIntRingBuffer()
        assertEquals(0, deque.addFront(1))
        assertEquals(1, deque.addBack(2))
        assertEquals(-1, deque.addFront(3))
        assertEquals(2, deque.addBack(4))
        assertEquals(-2, deque.addFront(5))
        assertEquals(listOf(5, 3, 1, 2, 4), deque.toList())
        deque.removeFrontUntil(1) // 1 is the index of "2"
        assertEquals(2, deque[1])
        assertEquals(listOf(2, 4), deque.toList())
        deque.removeFrontUntil(3) // 3 is the index of "2"
        assertEquals(listOf(), deque.toList())
    }
}
