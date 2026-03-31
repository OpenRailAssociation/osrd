package fr.sncf.osrd.utils

import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.seconds
import kotlin.time.TimeSource

private class TestPath

private fun offset(mm: Long) = Offset<TestPath>(Distance(mm))

private fun offset(m: Double) = Offset<TestPath>(m.meters)

private fun <T> entry(lower: Long, upper: Long, value: T) =
    OffsetRangeMap.RangeMapEntry(offset(lower), offset(upper), value)

class TestOffsetRangeMap {
    private fun <T> testPut(
        entries: List<OffsetRangeMap.RangeMapEntry<TestPath, T>>,
        expected: List<OffsetRangeMap.RangeMapEntry<TestPath, T>> = entries,
    ) {
        val rangeMap = offsetRangeMapOf<TestPath, T>()
        for (entry in entries) rangeMap.put(entry.lower, entry.upper, entry.value)
        assertEquals(expected, rangeMap.toList())

        val rangeMapMany = offsetRangeMapOf<TestPath, T>()
        rangeMapMany.putMany(entries)
        assertEquals(expected, rangeMapMany.toList())

        val rangeMapIterable = offsetRangeMapOf(entries)
        assertEquals(expected, rangeMapIterable.toList())

        val rangeMapSequence = offsetRangeMapOf(entries.asSequence())
        assertEquals(expected, rangeMapSequence.toList())
    }

    @Test
    fun testEmpty() {
        val rangeMap = offsetRangeMapOf<TestPath, Int>()
        assertEquals(emptyList(), rangeMap.toList())
    }

    @Test
    fun testSingleEntry() {
        testPut(listOf(entry(100, 1000, 42)))
    }

    @Test
    fun testEmptyEntry() {
        testPut(listOf(entry(100, 100, 42)), emptyList())
    }

    @Test
    fun testOverlappingRanges() {
        testPut(
            listOf(entry(100, 200, 42), entry(150, 300, 43)),
            listOf(entry(100, 150, 42), entry(150, 300, 43)),
        )
    }

    @Test
    fun testNonOverlappingRanges() {
        testPut(listOf(entry(100, 200, 42), entry(300, 400, 43)))
    }

    @Test
    fun testSplitRange() {
        testPut(
            listOf(entry(100, 200, 42), entry(120, 130, 43)),
            listOf(entry(100, 120, 42), entry(120, 130, 43), entry(130, 200, 42)),
        )
    }

    @Test
    fun testOverwritingSeveralRanges() {
        testPut(
            listOf(
                entry(0, 100, 1),
                entry(100, 200, 2),
                entry(200, 300, 3),
                entry(300, 400, 4),
                entry(400, 500, 5),
                entry(50, 450, 42),
            ),
            listOf(entry(0, 50, 1), entry(50, 450, 42), entry(450, 500, 5)),
        )
    }

    @Test
    fun testAddingFromEnd() {
        testPut(
            listOf(entry(100, 200, 1), entry(0, 100, 2)),
            listOf(entry(0, 100, 2), entry(100, 200, 1)),
        )
    }

    @Test
    fun testMergeRanges() {
        testPut(
            listOf(
                entry(0, 100, 42),
                entry(100, 200, 2),
                entry(200, 300, 3),
                entry(300, 400, 4),
                entry(400, 500, 42),
                entry(50, 450, 42),
            ),
            listOf(entry(0, 500, 42)),
        )
    }

    @Test
    fun testAdjacentRanges() {
        testPut(listOf(entry(0, 5, 1), entry(5, 10, 1)), listOf(entry(0, 10, 1)))
    }

    @Test
    fun testTruncate() {
        val rangeMap = offsetRangeMapOf<TestPath, Int>()
        rangeMap.put(offset(0), offset(100), 41)
        rangeMap.put(offset(200), offset(300), 42)
        rangeMap.truncate(offset(250), offset(260))
        assertEquals(listOf(entry(250, 260, 42)), rangeMap.toList())
    }

    @Test
    fun testTruncateAll() {
        val rangeMap = offsetRangeMapOf<TestPath, Int>()
        rangeMap.put(offset(0), offset(100), 41)
        rangeMap.put(offset(200), offset(300), 42)
        rangeMap.truncate(offset(0), offset(0))
        assertEquals(listOf(), rangeMap.toList())
    }

    @Test
    fun testTruncateToEmptyRange() {
        val rangeMap = offsetRangeMapOf<TestPath, Int>()
        rangeMap.put(offset(0), offset(100), 41)
        rangeMap.put(offset(200), offset(300), 42)
        rangeMap.truncate(offset(150), offset(160))
        assertEquals(listOf(), rangeMap.toList())
    }

    @Test
    fun testTruncateEmptyRange() {
        val rangeMap = offsetRangeMapOf<TestPath, Int>()
        rangeMap.truncate(offset(150), offset(160))
        assertEquals(rangeMap, rangeMap)
    }

    @Test
    fun testShift() {
        val rangeMap = offsetRangeMapOf<TestPath, Int>()
        rangeMap.put(offset(0), offset(100), 41)
        rangeMap.put(offset(200), offset(300), 42)
        rangeMap.shiftPositions(Distance(-100))
        assertEquals(listOf(entry(-100, 0, 41), entry(100, 200, 42)), rangeMap.toList())
    }

    @Test
    fun testPutManyOnNonEmpty() {
        val rangeMap = offsetRangeMapOf<TestPath, Int>()
        rangeMap.put(offset(100), offset(1000), 42)
        rangeMap.putMany(listOf(entry(100, 500, 41), entry(600, 1000, 43)))
        assertEquals(
            listOf(entry(100, 500, 41), entry(500, 600, 42), entry(600, 1000, 43)),
            rangeMap.toList(),
        )
    }

    @Test
    fun testLarge() {
        val n = 10000
        val oneSecond = 1.seconds
        val timeSource = TimeSource.Monotonic
        val entries = List(n) { entry(it.toLong(), it.toLong() + 1, it) }

        val mark1 = timeSource.markNow()
        val mark2 = mark1 + oneSecond
        val rangeMap = offsetRangeMapOf<TestPath, Int>()
        rangeMap.putMany(entries)
        assertFalse(mark2.hasPassedNow())
        assertEquals(entries, rangeMap.toList())

        val mark3 = timeSource.markNow()
        val mark4 = mark3 + oneSecond
        val rangeMapIterable = offsetRangeMapOf(entries)
        assertFalse(mark4.hasPassedNow())
        assertEquals(entries, rangeMapIterable.toList())
    }

    @Test
    fun updateMapIntersection() {
        val map = offsetRangeMapOf<TestPath, String>()
        map.put(offset(0.0), offset(10.0), "A")
        val updateMap = offsetRangeMapOf<TestPath, String>()
        updateMap.put(offset(5.0), offset(15.0), "B")
        map.updateMapIntersection(updateMap) { old, new -> old + new }
        assertEquals("AB", map.get(offset(7.5)))
        assertEquals("A", map.get(offset(2.5)))
        assertNull(map.get(offset(12.5)))
    }

    @Test
    fun updateMap_noOverlap() {
        val map = offsetRangeMapOf<TestPath, String>()
        map.put(offset(0.0), offset(5.0), "A")
        val update = offsetRangeMapOf<TestPath, String>()
        update.put(offset(10.0), offset(15.0), "B")
        map.updateMap(update, { old, new -> old + new })
        assertEquals("A", map.get(offset(2.5)))
        assertEquals("B", map.get(offset(12.5)))
        assertNull(map.get(offset(7.5)))
    }

    @Test
    fun updateMap_partialOverlap() {
        val map = offsetRangeMapOf<TestPath, String>()
        map.put(offset(0.0), offset(10.0), "A")
        val update = offsetRangeMapOf<TestPath, String>()
        update.put(offset(5.0), offset(15.0), "B")
        map.updateMap(update, { old, new -> old + new })
        assertEquals("A", map.get(offset(2.5)))
        assertEquals("AB", map.get(offset(7.5)))
        assertEquals("B", map.get(offset(12.5)))
    }

    @Test
    fun updateMap_fullOverlap() {
        val map = offsetRangeMapOf<TestPath, String>()
        map.put(offset(0.0), offset(10.0), "A")
        val update = offsetRangeMapOf<TestPath, String>()
        update.put(offset(0.0), offset(10.0), "B")
        map.updateMap(update, { old, new -> old + new })
        assertEquals("AB", map.get(offset(5.0)))
    }

    @Test
    fun updateMap_multipleRanges() {
        val map = offsetRangeMapOf<TestPath, String>()
        map.put(offset(0.0), offset(5.0), "A")
        map.put(offset(10.0), offset(15.0), "C")
        val update = offsetRangeMapOf<TestPath, String>()
        update.put(offset(3.0), offset(12.0), "B")
        map.updateMap(update, { old, new -> old + new })
        assertEquals("A", map.get(offset(1.0)))
        assertEquals("AB", map.get(offset(4.0)))
        assertEquals("B", map.get(offset(8.0)))
        assertEquals("CB", map.get(offset(11.0)))
        assertEquals("C", map.get(offset(14.0)))
    }

    @Test
    fun updateMapKeepingNonIntersecting_emptyUpdate() {
        val map = offsetRangeMapOf<TestPath, String>()
        map.put(offset(0.0), offset(10.0), "A")
        val update = offsetRangeMapOf<TestPath, String>()
        map.updateMap(update, { old, new -> old + new })
        assertEquals("A", map.get(offset(5.0)))
    }

    @Test
    fun updateMap_emptyOriginal() {
        val map = offsetRangeMapOf<TestPath, String>()
        val update = offsetRangeMapOf<TestPath, String>()
        update.put(offset(0.0), offset(10.0), "B")
        map.updateMap(update, { old, new -> old + new })
        assertEquals("B", map.get(offset(5.0)))
    }

    @Test
    fun clear() {
        val map = offsetRangeMapOf<TestPath, String>()
        map.put(offset(0.0), offset(10.0), "A")
        map.clear()
        assertNull(map.get(offset(5.0)))
    }

    @Test
    fun fullyCovers() {
        val map =
            offsetRangeMapOf(
                OffsetRangeMap.RangeMapEntry(offset(0.0), offset(1.0), true),
                OffsetRangeMap.RangeMapEntry(offset(1.0), offset(4.0), true),
                OffsetRangeMap.RangeMapEntry(offset(7.0), offset(9.0), true),
            )
        assertTrue(map.fullyCovers(offset(-1.0)))
        assertTrue(map.fullyCovers(offset(0.0)))
        assertTrue(map.fullyCovers(offset(1.0)))
        assertTrue(map.fullyCovers(offset(2.0)))
        assertTrue(map.fullyCovers(offset(3.0)))
        assertTrue(map.fullyCovers(offset(4.0)))
        assertFalse(map.fullyCovers(offset(5.0)))
        assertFalse(map.fullyCovers(offset(6.0)))
        assertFalse(map.fullyCovers(offset(7.0)))
        assertFalse(map.fullyCovers(offset(8.0)))
        assertFalse(map.fullyCovers(offset(9.0)))
        assertFalse(map.fullyCovers(offset(10.0)))
    }

    @Test
    fun mapToRangeSet() {
        val map = offsetRangeMapOf<TestPath, String>()
        map.put(offset(0.0), offset(10.0), "A")
        map.put(offset(10.0), offset(20.0), "B")
        map.put(offset(20.0), offset(30.0), "A")
        val distanceMap =
            distanceRangeMapOf(
                DistanceRangeMap.RangeMapEntry(offset(0.0).distance, offset(10.0).distance, "A"),
                DistanceRangeMap.RangeMapEntry(offset(10.0).distance, offset(20.0).distance, "B"),
                DistanceRangeMap.RangeMapEntry(offset(20.0).distance, offset(30.0).distance, "A"),
            )
        val predicate: (String) -> Boolean = { it == "A" }
        assertEquals(
            distanceMap.mapToRangeSet(predicate).asList(),
            map.mapToRangeSet(predicate).asList(),
        )
    }

    @Test
    fun fullyCoversEmptyMap() {
        val map = offsetRangeMapOf<TestPath, Boolean>()
        assertTrue(map.fullyCovers(offset(-1.0)))
        assertTrue(map.fullyCovers(offset(0.0)))
        assertFalse(map.fullyCovers(offset(1.0)))
    }
}
