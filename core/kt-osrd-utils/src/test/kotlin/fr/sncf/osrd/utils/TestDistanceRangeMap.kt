package fr.sncf.osrd.utils

import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.meters
import org.junit.Test
import kotlin.test.assertEquals

class TestDistanceRangeMap {
    @Test
    fun testEmpty() {
        val rangeMap = DistanceRangeMapImpl<Int>()
        assertEquals(emptyList(), rangeMap.asList())
    }

    @Test
    fun testSingleEntry() {
        val rangeMap = DistanceRangeMapImpl<Int>()
        rangeMap.put(Distance(100), Distance(1000), 42)
        assertEquals(listOf(
            DistanceRangeMap.RangeMapEntry(
            Distance(100), Distance(1000), 42
        )), rangeMap.asList())
    }

    @Test
    fun testEmptyEntry() {
        val rangeMap = DistanceRangeMapImpl<Int>()
        rangeMap.put(Distance(100), Distance(100), 42)
        assertEquals(emptyList(), rangeMap.asList())
    }

    @Test
    fun testOverlappingRanges() {
        val rangeMap = DistanceRangeMapImpl<Int>()
        rangeMap.put(Distance(100), Distance(200), 42)
        rangeMap.put(Distance(150), Distance(300), 43)
        assertEquals(listOf(
            DistanceRangeMap.RangeMapEntry(Distance(100), Distance(150), 42),
                    DistanceRangeMap.RangeMapEntry(Distance(150), Distance(300), 43)
        ), rangeMap.asList())
    }

    @Test
    fun testNonOverlappingRanges() {
        val rangeMap = DistanceRangeMapImpl<Int>()
        rangeMap.put(Distance(100), Distance(200), 42)
        rangeMap.put(Distance(300), Distance(400), 43)
        assertEquals(listOf(
            DistanceRangeMap.RangeMapEntry(Distance(100), Distance(200), 42),
            DistanceRangeMap.RangeMapEntry(Distance(300), Distance(400), 43)
        ), rangeMap.asList())
    }

    @Test
    fun testSplitRange() {
        val rangeMap = DistanceRangeMapImpl<Int>()
        rangeMap.put(Distance(100), Distance(200), 42)
        rangeMap.put(Distance(120), Distance(130), 43)
        assertEquals(listOf(
            DistanceRangeMap.RangeMapEntry(Distance(100), Distance(120), 42),
            DistanceRangeMap.RangeMapEntry(Distance(120), Distance(130), 43),
            DistanceRangeMap.RangeMapEntry(Distance(130), Distance(200), 42)
        ), rangeMap.asList())
    }

    @Test
    fun testOverwritingSeveralRanges() {
        val rangeMap = DistanceRangeMapImpl<Int>()
        rangeMap.put(Distance(0), Distance(100), 1)
        rangeMap.put(Distance(100), Distance(200), 2)
        rangeMap.put(Distance(200), Distance(300), 3)
        rangeMap.put(Distance(300), Distance(400), 4)
        rangeMap.put(Distance(400), Distance(500), 5)
        rangeMap.put(Distance(50), Distance(450), 42)
        assertEquals(listOf(
            DistanceRangeMap.RangeMapEntry(Distance(0), Distance(50), 1),
            DistanceRangeMap.RangeMapEntry(Distance(50), Distance(450), 42),
            DistanceRangeMap.RangeMapEntry(Distance(450), Distance(500), 5)
        ), rangeMap.asList())
    }

    @Test
    fun testMergeRanges() {
        val rangeMap = DistanceRangeMapImpl<Int>()
        rangeMap.put(Distance(0), Distance(100), 42)
        rangeMap.put(Distance(100), Distance(200), 2)
        rangeMap.put(Distance(200), Distance(300), 3)
        rangeMap.put(Distance(300), Distance(400), 4)
        rangeMap.put(Distance(400), Distance(500), 42)
        rangeMap.put(Distance(50), Distance(450), 42)
        assertEquals(listOf(
            DistanceRangeMap.RangeMapEntry(Distance(0), Distance(500), 42),
        ), rangeMap.asList())
    }

    @Test
    fun testTruncate() {
        val rangeMap = DistanceRangeMapImpl<Int>()
        rangeMap.put(Distance(0), Distance(100), 41)
        rangeMap.put(Distance(200), Distance(300), 42)
        rangeMap.truncate(Distance(250), Distance(260))
        assertEquals(listOf(
            DistanceRangeMap.RangeMapEntry(Distance(250), Distance(260), 42),
        ), rangeMap.asList())
    }

    @Test
    fun testTruncateAll() {
        val rangeMap = DistanceRangeMapImpl<Int>()
        rangeMap.put(Distance(0), Distance(100), 41)
        rangeMap.put(Distance(200), Distance(300), 42)
        rangeMap.truncate(Distance(0), Distance(0))
        assertEquals(listOf(), rangeMap.asList())
    }

    @Test
    fun testTruncateToEmptyRange() {
        val rangeMap = DistanceRangeMapImpl<Int>()
        rangeMap.put(Distance(0), Distance(100), 41)
        rangeMap.put(Distance(200), Distance(300), 42)
        rangeMap.truncate(Distance(150), Distance(160))
        assertEquals(listOf(), rangeMap.asList())
    }

    @Test
    fun testShift() {
        val rangeMap = DistanceRangeMapImpl<Int>()
        rangeMap.put(Distance(0), Distance(100), 41)
        rangeMap.put(Distance(200), Distance(300), 42)
        rangeMap.shiftPositions(Distance(-100))
        assertEquals(listOf(
            DistanceRangeMap.RangeMapEntry(Distance(-100), Distance(0), 41),
            DistanceRangeMap.RangeMapEntry(Distance(100), Distance(200), 42),
        ), rangeMap.asList())
    }
}