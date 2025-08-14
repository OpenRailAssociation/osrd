package fr.sncf.osrd.utils

import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.meters
import kotlin.test.assertEquals
import kotlin.time.*
import kotlin.time.Duration.Companion.seconds
import org.junit.Assert.*
import org.junit.Test

class TestDistanceRangeMap {
    private fun <T> testPut(
        entries: List<DistanceRangeMap.RangeMapEntry<T>>,
        expected: List<DistanceRangeMap.RangeMapEntry<T>> = entries,
    ) {
        val rangeMap = distanceRangeMapOf<T>()
        for (entry in entries) rangeMap.put(entry.lower, entry.upper, entry.value)
        assertEquals(expected, rangeMap.asList())

        val rangeMapMany = distanceRangeMapOf<T>()
        rangeMapMany.putMany(entries)
        assertEquals(expected, rangeMapMany.asList())

        val rangeMapCtor = DistanceRangeMapImpl(entries)
        assertEquals(expected, rangeMapCtor.asList())
    }

    @Test
    fun testEmpty() {
        val rangeMap = distanceRangeMapOf<Int>()
        assertEquals(emptyList(), rangeMap.asList())
    }

    @Test
    fun testSingleEntry() {
        val entries = listOf(DistanceRangeMap.RangeMapEntry(Distance(100), Distance(1000), 42))

        testPut(entries)
    }

    @Test
    fun testEmptyEntry() {
        val entries = listOf(DistanceRangeMap.RangeMapEntry(Distance(100), Distance(100), 42))

        testPut(entries, emptyList())
    }

    @Test
    fun testOverlappingRanges() {
        val entries =
            listOf(
                DistanceRangeMap.RangeMapEntry(Distance(100), Distance(200), 42),
                DistanceRangeMap.RangeMapEntry(Distance(150), Distance(300), 43),
            )
        val expected =
            listOf(
                DistanceRangeMap.RangeMapEntry(Distance(100), Distance(150), 42),
                DistanceRangeMap.RangeMapEntry(Distance(150), Distance(300), 43),
            )

        testPut(entries, expected)
    }

    @Test
    fun testNonOverlappingRanges() {
        val entries =
            listOf(
                DistanceRangeMap.RangeMapEntry(Distance(100), Distance(200), 42),
                DistanceRangeMap.RangeMapEntry(Distance(300), Distance(400), 43),
            )

        testPut(entries)
    }

    @Test
    fun testSplitRange() {
        val entries =
            listOf(
                DistanceRangeMap.RangeMapEntry(Distance(100), Distance(200), 42),
                DistanceRangeMap.RangeMapEntry(Distance(120), Distance(130), 43),
            )
        val expected =
            listOf(
                DistanceRangeMap.RangeMapEntry(Distance(100), Distance(120), 42),
                DistanceRangeMap.RangeMapEntry(Distance(120), Distance(130), 43),
                DistanceRangeMap.RangeMapEntry(Distance(130), Distance(200), 42),
            )

        testPut(entries, expected)
    }

    @Test
    fun testOverwritingSeveralRanges() {
        val entries =
            listOf(
                DistanceRangeMap.RangeMapEntry(Distance(0), Distance(100), 1),
                DistanceRangeMap.RangeMapEntry(Distance(100), Distance(200), 2),
                DistanceRangeMap.RangeMapEntry(Distance(200), Distance(300), 3),
                DistanceRangeMap.RangeMapEntry(Distance(300), Distance(400), 4),
                DistanceRangeMap.RangeMapEntry(Distance(400), Distance(500), 5),
                DistanceRangeMap.RangeMapEntry(Distance(50), Distance(450), 42),
            )
        val expected =
            listOf(
                DistanceRangeMap.RangeMapEntry(Distance(0), Distance(50), 1),
                DistanceRangeMap.RangeMapEntry(Distance(50), Distance(450), 42),
                DistanceRangeMap.RangeMapEntry(Distance(450), Distance(500), 5),
            )

        testPut(entries, expected)
    }

    @Test
    fun testAddingFromEnd() {
        val entries =
            listOf(
                DistanceRangeMap.RangeMapEntry(Distance(100), Distance(200), 1),
                DistanceRangeMap.RangeMapEntry(Distance(0), Distance(100), 2),
            )
        val expected =
            listOf(
                DistanceRangeMap.RangeMapEntry(Distance(0), Distance(100), 2),
                DistanceRangeMap.RangeMapEntry(Distance(100), Distance(200), 1),
            )

        testPut(entries, expected)
    }

    @Test
    fun testMergeRanges() {
        val entries =
            listOf(
                DistanceRangeMap.RangeMapEntry(Distance(0), Distance(100), 42),
                DistanceRangeMap.RangeMapEntry(Distance(100), Distance(200), 2),
                DistanceRangeMap.RangeMapEntry(Distance(200), Distance(300), 3),
                DistanceRangeMap.RangeMapEntry(Distance(300), Distance(400), 4),
                DistanceRangeMap.RangeMapEntry(Distance(400), Distance(500), 42),
                DistanceRangeMap.RangeMapEntry(Distance(50), Distance(450), 42),
            )
        val expected = listOf(DistanceRangeMap.RangeMapEntry(Distance(0), Distance(500), 42))

        testPut(entries, expected)
    }

    @Test
    fun testAdjacentRanges() {
        val entries =
            listOf(
                DistanceRangeMap.RangeMapEntry(Distance(0), Distance(5), 1),
                DistanceRangeMap.RangeMapEntry(Distance(5), Distance(10), 1),
            )
        val expected = listOf(DistanceRangeMap.RangeMapEntry(Distance(0), Distance(10), 1))

        testPut(entries, expected)
    }

    @Test
    fun testTruncate() {
        val rangeMap = distanceRangeMapOf<Int>()
        rangeMap.put(Distance(0), Distance(100), 41)
        rangeMap.put(Distance(200), Distance(300), 42)
        rangeMap.truncate(Distance(250), Distance(260))
        assertEquals(
            listOf(DistanceRangeMap.RangeMapEntry(Distance(250), Distance(260), 42)),
            rangeMap.asList(),
        )
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
        assertEquals(
            listOf(
                DistanceRangeMap.RangeMapEntry(Distance(-100), Distance(0), 41),
                DistanceRangeMap.RangeMapEntry(Distance(100), Distance(200), 42),
            ),
            rangeMap.asList(),
        )
    }

    @Test
    fun testPutManyOnNonEmpty() {
        val rangeMap = distanceRangeMapOf<Int>()
        rangeMap.put(Distance(100), Distance(1000), 42)
        val entries =
            listOf(
                DistanceRangeMap.RangeMapEntry(Distance(100), Distance(500), 41),
                DistanceRangeMap.RangeMapEntry(Distance(600), Distance(1000), 43),
            )
        rangeMap.putMany(entries)
        assertEquals(
            listOf(
                DistanceRangeMap.RangeMapEntry(Distance(100), Distance(500), 41),
                DistanceRangeMap.RangeMapEntry(Distance(500), Distance(600), 42),
                DistanceRangeMap.RangeMapEntry(Distance(600), Distance(1000), 43),
            ),
            rangeMap.asList(),
        )
    }

    @Test
    fun testLarge() {
        val n = 10000
        val oneSecond: Duration = 1.seconds
        val timeSource = TimeSource.Monotonic
        val entries =
            List(n) {
                DistanceRangeMap.RangeMapEntry(Distance(it.toLong()), Distance(it.toLong() + 1), it)
            }

        val mark1 = timeSource.markNow()
        val mark2 = mark1 + oneSecond
        val rangeMap = distanceRangeMapOf<Int>()
        rangeMap.putMany(entries)
        assert(!mark2.hasPassedNow())
        assertEquals(entries, rangeMap.asList())

        val mark3 = timeSource.markNow()
        val mark4 = mark3 + oneSecond
        val rangeMapCtor = DistanceRangeMapImpl(entries)
        assert(!mark4.hasPassedNow())
        assertEquals(entries, rangeMapCtor.asList())
    }

    @Test
    fun testMergeDistanceRangeMapsEmpty() {
        val rangeMap = mergeDistanceRangeMaps<Int>(emptyList(), emptyList())

        assertEquals(emptyList(), rangeMap.asList())
    }

    @Test
    fun testMergeDistanceRangeMapsSimple() {
        val inputMap =
            distanceRangeMapOf(
                DistanceRangeMap.RangeMapEntry(Distance(0), Distance(50), 1),
                DistanceRangeMap.RangeMapEntry(Distance(50), Distance(100), 2),
            )
        val distances = listOf(Distance(100))

        val rangeMap = mergeDistanceRangeMaps<Int>(listOf(inputMap, inputMap), distances)

        assertEquals(
            listOf(
                DistanceRangeMap.RangeMapEntry(Distance(0), Distance(50), 1),
                DistanceRangeMap.RangeMapEntry(Distance(50), Distance(100), 2),
                DistanceRangeMap.RangeMapEntry(Distance(100), Distance(150), 1),
                DistanceRangeMap.RangeMapEntry(Distance(150), Distance(200), 2),
            ),
            rangeMap.asList(),
        )
    }

    @Test
    fun testMergeDistanceRangeMapsLarge() {
        val n = 200
        val oneSecond: Duration = 1.seconds
        val timeSource = TimeSource.Monotonic
        val distances = List(n - 1) { Distance(n.toLong()) }
        val maps: MutableList<DistanceRangeMap<Int>> = mutableListOf()
        for (i in 0..<n) {
            val entries =
                List(n) {
                    DistanceRangeMap.RangeMapEntry(
                        Distance(it.toLong()),
                        Distance(it.toLong() + 1),
                        i * n + it,
                    )
                }
            maps.add(DistanceRangeMapImpl<Int>(entries))
        }
        val mergedEntries =
            List(n * n) {
                DistanceRangeMap.RangeMapEntry(Distance(it.toLong()), Distance(it.toLong() + 1), it)
            }

        val mark1 = timeSource.markNow()
        val mark2 = mark1 + oneSecond
        val rangeMap = mergeDistanceRangeMaps<Int>(maps, distances)
        assert(!mark2.hasPassedNow())
        assertEquals(mergedEntries, rangeMap.asList())
    }

    @Test
    fun updateMapIntersection() {
        val map = DistanceRangeMapImpl<String>()
        map.put(0.0.meters, 10.0.meters, "A")
        val updateMap = DistanceRangeMapImpl<String>()
        updateMap.put(5.0.meters, 15.0.meters, "B")
        map.updateMapIntersection(updateMap) { old, new -> old + new }
        assertEquals("AB", map.get(7.5.meters))
        assertEquals("A", map.get(2.5.meters))
        assertNull(map.get(12.5.meters))
    }

    @Test
    fun updateMap_noOverlap() {
        val map = DistanceRangeMapImpl<String>()
        map.put(0.0.meters, 5.0.meters, "A")
        val update = DistanceRangeMapImpl<String>()
        update.put(10.0.meters, 15.0.meters, "B")
        map.updateMap(update, { old, new -> old + new })
        assertEquals("A", map.get(2.5.meters))
        assertEquals("B", map.get(12.5.meters))
        assertNull(map.get(7.5.meters))
    }

    @Test
    fun updateMap_partialOverlap() {
        val map = DistanceRangeMapImpl<String>()
        map.put(0.0.meters, 10.0.meters, "A")
        val update = DistanceRangeMapImpl<String>()
        update.put(5.0.meters, 15.0.meters, "B")
        map.updateMap(update, { old, new -> old + new })
        assertEquals("A", map.get(2.5.meters))
        assertEquals("AB", map.get(7.5.meters))
        assertEquals("B", map.get(12.5.meters))
    }

    @Test
    fun updateMap_fullOverlap() {
        val map = DistanceRangeMapImpl<String>()
        map.put(0.0.meters, 10.0.meters, "A")
        val update = DistanceRangeMapImpl<String>()
        update.put(0.0.meters, 10.0.meters, "B")
        map.updateMap(update, { old, new -> old + new })
        assertEquals("AB", map.get(5.0.meters))
    }

    @Test
    fun updateMap_multipleRanges() {
        val map = DistanceRangeMapImpl<String>()
        map.put(0.0.meters, 5.0.meters, "A")
        map.put(10.0.meters, 15.0.meters, "C")
        val update = DistanceRangeMapImpl<String>()
        update.put(3.0.meters, 12.0.meters, "B")
        map.updateMap(update, { old, new -> old + new })
        assertEquals("A", map.get(1.0.meters))
        assertEquals("AB", map.get(4.0.meters))
        assertEquals("B", map.get(8.0.meters))
        assertEquals("CB", map.get(11.0.meters))
        assertEquals("C", map.get(14.0.meters))
    }

    @Test
    fun updateMapKeepingNonIntersecting_emptyUpdate() {
        val map = DistanceRangeMapImpl<String>()
        map.put(0.0.meters, 10.0.meters, "A")
        val update = DistanceRangeMapImpl<String>()
        map.updateMap(update, { old, new -> old + new })
        assertEquals("A", map.get(5.0.meters))
    }

    @Test
    fun updateMap_emptyOriginal() {
        val map = DistanceRangeMapImpl<String>()
        val update = DistanceRangeMapImpl<String>()
        update.put(0.0.meters, 10.0.meters, "B")
        map.updateMap(update, { old, new -> old + new })
        assertEquals("B", map.get(5.0.meters))
    }

    @Test
    fun clear() {
        val map = DistanceRangeMapImpl<String>()
        map.put(0.0.meters, 10.0.meters, "A")
        map.clear()
        assertNull(map.get(5.0.meters))
    }
}
