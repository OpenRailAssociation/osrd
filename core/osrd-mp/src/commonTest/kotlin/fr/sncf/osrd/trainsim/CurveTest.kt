package fr.sncf.osrd.trainsim

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CurveTest {
    /*
     * both curves represent this segment:
     *
     *        🭯
     *        │
     *        │
     *     10 ┤
     *        │^.
     *        │  ^.
     *        │    ^.
     *        │      ^.
     *        │        ^.
     *        │          ^.
     *        │            ^.
     *        ┼──────────────┬─────🭬
     *       0               10
     */
    private val dummyCurve = Curve((0L..10L).map { Vec2(it, 10 - it) })
    private val simpleCurve = Curve(Vec2(0, 10), Vec2(10, 0))

    @Test
    fun testGetPointAtNegativePosition() {
        assertNull(dummyCurve.getPointAt(-1))
    }

    @Test
    fun testGetPointAtZero() {
        val point = dummyCurve.getPointAt(0)
        assertNotNull(point)
        assertEquals(0, point.x)
        assertEquals(10, point.y)
    }

    @Test
    fun testGetPointAtEnd() {
        val point = dummyCurve.getPointAt(10)
        assertNotNull(point)
        assertEquals(10, point.x)
        assertEquals(0, point.y)
    }

    @Test
    fun testGetPointAtMiddle() {
        val point = dummyCurve.getPointAt(5)
        assertNotNull(point)
        assertEquals(5, point.x)
        assertEquals(5, point.y)
    }

    @Test
    fun testGetPointAtOutOfBoundsPosition() {
        // Almost in bound
        assertNull(dummyCurve.getPointAt(11))
        assertNull(dummyCurve.getPointAt(42))
    }

    @Test
    fun testLastGetLast() {
        val point = dummyCurve.last()
        assertNotNull(point)
        assertEquals(10, point.x)
        assertEquals(0, point.y)
    }

    @Test
    fun testLastGetFirst() {
        val point = dummyCurve.last(10)
        assertNotNull(point)
        assertEquals(0, point.x)
        assertEquals(10, point.y)
    }

    @Test
    fun testLastOutOfBounds() {
        // One after last
        assertNull(dummyCurve.last(-1))
        // One before beginning
        assertNull(dummyCurve.last(11))
    }

    @Test
    fun testLastGetMiddle() {
        val point = dummyCurve.last(4)
        assertNotNull(point)
        assertEquals(6, point.x)
        assertEquals(4, point.y)
    }

    @Test
    fun testIsBelowOverCurve() {
        val point = Vec2(4, 11)
        assertTrue(dummyCurve.isBelow(point))
    }

    @Test
    fun testIsBelowBelowCurve() {
        val point = Vec2(4, 2)
        assertFalse(dummyCurve.isBelow(point))
    }

    @Test
    fun testIsBelowOverAtEdge() {
        val point = Vec2(0, 11)
        assertTrue(dummyCurve.isBelow(point))
    }

    @Test
    fun testIsBelowUnderAtEdge() {
        val point = Vec2(0, 9)
        assertFalse(dummyCurve.isBelow(point))
    }

    @Test
    fun testIsBelowOnCurve() {
        val point = Vec2(5, 5)
        assertFalse(dummyCurve.isBelow(point))
    }

    @Test
    fun testIntersectsAtSimple() {
        val p = simpleCurve.intersectsAt(0, 0, 10, 10)
        assertEquals(Vec2(5, 5), p)
    }

    @Test
    fun testIntersectsAt() {
        val p = dummyCurve.intersectsAt(0, 0, 10, 10)
        assertEquals(Vec2(5, 5), p)
    }

    @Test
    fun testIntersectsAtAbove() {
        val p = simpleCurve.intersectsAt(0, 15, 10, 20)
        assertNull(p)
    }

    @Test
    fun testIntersectsAtTouchesStart() {
        val p = simpleCurve.intersectsAt(1, 9, 10, 20)
        assertEquals(Vec2(1, 9), p)
    }

    @Test
    fun testIntersectsAtTouchesEnd() {
        val p = simpleCurve.intersectsAt(2, 18, 9, 1)
        assertEquals(Vec2(9, 1), p)
    }

    @Test
    fun testIntersectsAtBefore() {
        val p = dummyCurve.intersectsAt(-5, 0, 0, 200)
        assertNull(p)
    }

    @Test
    fun testIntersectsAtBeforeTouches() {
        val p = dummyCurve.intersectsAt(-5, 10, 0, 10)
        assertNull(p)
        // TODO maybe assertEquals(Vec2(0,10), p) ?
    }

    @Test
    fun testIntersectsAtBeforeTouchesThenPasses() {
        val p = dummyCurve.intersectsAt(-5, 10, 10, 10)
        assertEquals(Vec2(0, 10), p)
    }

    @Test
    fun testIntersectsAtBeforeSameSlope() {
        val p = dummyCurve.intersectsAt(-5, 15, 5, 5)
        assertEquals(Vec2(0, 10), p)
    }

    @Test
    fun testIntersectsAtBeforeSameSlopeSimple() {
        val p = simpleCurve.intersectsAt(-5, 15, 10, 0)
        assertEquals(Vec2(0, 10), p)
    }

    @Test
    fun testIntersectsAtAfter() {
        val p = simpleCurve.intersectsAt(15, 15, 20, -5)
        assertNull(p)
    }

    @Test
    fun testIntersectsAtAfterTouches() {
        val p = simpleCurve.intersectsAt(10, 0, 20, 0)
        assertNull(p)
        // TODO maybe assertEquals(Vec2(10,0), p) ?
    }

    @Test
    fun testIntersectsAtAfterPassesThenTouches() {
        val p = simpleCurve.intersectsAt(1, 0, 20, 0)
        assertNull(p)
        // TODO maybe assertEquals(Vec2(10,0), p) ?
    }
}
