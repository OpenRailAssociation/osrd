package fr.sncf.osrd.utils

import fr.sncf.osrd.utils.units.Distance
import org.junit.Test
import kotlin.test.assertEquals

class TestDistanceRangeMap {
    fun <T>testPut(entries: List<DistanceRangeMap.RangeMapEntry<T>>,
                   expected: List<DistanceRangeMap.RangeMapEntry<T>> = entries){
        val rangeMap = distanceRangeMapOf<T>()
        for (entry in entries)
            rangeMap.put(entry.lower, entry.upper, entry.value)
        assertEquals(expected, rangeMap.asList())

        val rangeMapMany = distanceRangeMapOf<T>()
        rangeMapMany.putMany(entries)
        assertEquals(expected, rangeMapMany.asList())
    }

    @Test
    fun testEmpty() {
        val rangeMap = distanceRangeMapOf<Int>()
        assertEquals(emptyList(), rangeMap.asList())
    }

    @Test
    fun testSingleEntry() {
        val entries = listOf(DistanceRangeMap.RangeMapEntry(
            Distance(100), Distance(1000), 42
        ))

        testPut(entries)
    }

    @Test
    fun testEmptyEntry() {
        val entries = listOf(DistanceRangeMap.RangeMapEntry(
            Distance(100), Distance(100), 42
        ))

        testPut(entries, emptyList())
    }

    @Test
    fun testOverlappingRanges() {
        val entries = listOf(
            DistanceRangeMap.RangeMapEntry(Distance(100), Distance(200), 42),
            DistanceRangeMap.RangeMapEntry(Distance(150), Distance(300), 43)
        )
        val expected = listOf(
            DistanceRangeMap.RangeMapEntry(Distance(100), Distance(150), 42),
            DistanceRangeMap.RangeMapEntry(Distance(150), Distance(300), 43)
        )

        testPut(entries, expected)
    }

    @Test
    fun testNonOverlappingRanges() {
        val entries = listOf(
            DistanceRangeMap.RangeMapEntry(Distance(100), Distance(200), 42),
            DistanceRangeMap.RangeMapEntry(Distance(300), Distance(400), 43)
        )

        testPut(entries)
    }

    @Test
    fun testSplitRange() {
        val entries = listOf(
            DistanceRangeMap.RangeMapEntry(Distance(100), Distance(200), 42),
            DistanceRangeMap.RangeMapEntry(Distance(120), Distance(130), 43)
        )
        val expected = listOf(
            DistanceRangeMap.RangeMapEntry(Distance(100), Distance(120), 42),
            DistanceRangeMap.RangeMapEntry(Distance(120), Distance(130), 43),
            DistanceRangeMap.RangeMapEntry(Distance(130), Distance(200), 42),
        )

        testPut(entries, expected)
    }

    @Test
    fun testOverwritingSeveralRanges() {
        val entries = listOf(
            DistanceRangeMap.RangeMapEntry(Distance(0), Distance(100), 1),
            DistanceRangeMap.RangeMapEntry(Distance(100), Distance(200), 2),
            DistanceRangeMap.RangeMapEntry(Distance(200), Distance(300), 3),
            DistanceRangeMap.RangeMapEntry(Distance(300), Distance(400), 4),
            DistanceRangeMap.RangeMapEntry(Distance(400), Distance(500), 5),
            DistanceRangeMap.RangeMapEntry(Distance(50), Distance(450), 42)
        )
        val expected = listOf(
            DistanceRangeMap.RangeMapEntry(Distance(0), Distance(50), 1),
            DistanceRangeMap.RangeMapEntry(Distance(50), Distance(450), 42),
            DistanceRangeMap.RangeMapEntry(Distance(450), Distance(500), 5)
        )

        testPut(entries, expected)
    }

    @Test
    fun testAddingFromEnd() {
        val entries = listOf(
            DistanceRangeMap.RangeMapEntry(Distance(100), Distance(200), 1),
            DistanceRangeMap.RangeMapEntry(Distance(0), Distance(100), 2),
        )
        val expected = listOf(
            DistanceRangeMap.RangeMapEntry(Distance(0), Distance(100), 2),
            DistanceRangeMap.RangeMapEntry(Distance(100), Distance(200), 1),
        )

        testPut(entries, expected)
    }

    @Test
    fun testMergeRanges() {
        val entries = listOf(
            DistanceRangeMap.RangeMapEntry(Distance(0), Distance(100), 42),
            DistanceRangeMap.RangeMapEntry(Distance(100), Distance(200), 2),
            DistanceRangeMap.RangeMapEntry(Distance(200), Distance(300), 3),
            DistanceRangeMap.RangeMapEntry(Distance(300), Distance(400), 4),
            DistanceRangeMap.RangeMapEntry(Distance(400), Distance(500), 42),
            DistanceRangeMap.RangeMapEntry(Distance(50), Distance(450), 42)
        )
        val expected = listOf(
            DistanceRangeMap.RangeMapEntry(Distance(0), Distance(500), 42)
        )

        testPut(entries, expected)
    }

    @Test
    fun testTruncate() {
        val rangeMap = distanceRangeMapOf<Int>()
        rangeMap.put(Distance(0), Distance(100), 41)
        rangeMap.put(Distance(200), Distance(300), 42)
        rangeMap.truncate(Distance(250), Distance(260))
        assertEquals(listOf(
            DistanceRangeMap.RangeMapEntry(Distance(250), Distance(260), 42),
        ), rangeMap.asList())
    }

    @Test
    fun testTruncateAll() {
        val rangeMap = distanceRangeMapOf<Int>()
        rangeMap.put(Distance(0), Distance(100), 41)
        rangeMap.put(Distance(200), Distance(300), 42)
        rangeMap.truncate(Distance(0), Distance(0))
        assertEquals(listOf(), rangeMap.asList())
    }

    @Test
    fun testTruncateToEmptyRange() {
        val rangeMap = distanceRangeMapOf<Int>()
        rangeMap.put(Distance(0), Distance(100), 41)
        rangeMap.put(Distance(200), Distance(300), 42)
        rangeMap.truncate(Distance(150), Distance(160))
        assertEquals(listOf(), rangeMap.asList())
    }

    @Test
    fun testTruncateEmptyRange() {
        val rangeMap = distanceRangeMapOf<Int>()
        rangeMap.truncate(Distance(150), Distance(160))
        assertEquals(rangeMap, rangeMap)
    }

    @Test
    fun testShift() {
        val rangeMap = distanceRangeMapOf<Int>()
        rangeMap.put(Distance(0), Distance(100), 41)
        rangeMap.put(Distance(200), Distance(300), 42)
        rangeMap.shiftPositions(Distance(-100))
        assertEquals(listOf(
            DistanceRangeMap.RangeMapEntry(Distance(-100), Distance(0), 41),
            DistanceRangeMap.RangeMapEntry(Distance(100), Distance(200), 42),
        ), rangeMap.asList())
    }
}
