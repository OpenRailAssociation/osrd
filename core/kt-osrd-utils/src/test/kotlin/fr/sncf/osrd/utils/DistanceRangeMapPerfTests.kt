package fr.sncf.osrd.utils

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.Range
import com.google.common.collect.TreeRangeMap
import fr.sncf.osrd.utils.DistanceRangeMap.RangeMapEntry
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.meters
import kotlin.time.Duration
import kotlin.time.measureTime
import org.junit.Test

class DistanceRangeMapPerfTests {
    /**
     * Not an actual test, just an easy way to get some code running without dealing with jars and
     * command line parameters
     */
    @Test
    fun performances() {
        val params =
            TestParams(nMaps = 1_000, nEntries = 1_000, iterationCount = 1_000, initCount = 100)
        val tests = makeTests(params)
        for (test in tests) println("$test")
    }

    @Test
    fun memory() {
        println("building the maps")
        val params = TestParams(nMaps = 10_000, nEntries = 100, iterationCount = 0, initCount = 1)
        val tests = makeTests(params)
        // Workflow: Intellij (probably ultimate only)
        // Run the test, wait for the message, then profiler -> select process -> capture memory
        // snapshot. Find `RangeMapTest` in the list and click it to see the objects.
        println("maps are constructed, run a jvm memory snapshot now")
        Thread.sleep(1_000_000)
        for (test in tests) println("$test")
    }

    fun makeTests(params: TestParams): List<RangeMapTest<*>> {
        val ours =
            RangeMapTest(
                name = "ours",
                testParams = params,
                init = { entries ->
                    distanceRangeMapOf(entries.map { RangeMapEntry(it.from, it.to, it.value) })
                },
                iteration = {
                    var dummyAcc = 0
                    for (entry in it) dummyAcc += entry.value
                    dummyAcc
                },
            )

        val immutable =
            RangeMapTest(
                name = "immutable",
                testParams = params,
                init = { entries ->
                    val builder = ImmutableRangeMap.builder<Distance, Int>()
                    entries.forEach { builder.put(Range.open(it.from, it.to), it.value) }
                    builder.build()
                },
                iteration = {
                    var dummyAcc = 0
                    for (entry in it.asMapOfRanges()) dummyAcc += entry.value
                    dummyAcc
                },
            )

        val tree =
            RangeMapTest(
                name = "tree",
                testParams = params,
                init = { entries ->
                    val map = TreeRangeMap.create<Distance, Int>()
                    entries.forEach { map.put(Range.open(it.from, it.to), it.value) }
                    map
                },
                iteration = {
                    var dummyAcc = 0
                    for (entry in it.asMapOfRanges()) dummyAcc += entry.value
                    dummyAcc
                },
            )

        val guavaAsConstructor =
            RangeMapTest(
                name = "guavaAsConstructor",
                testParams = params,
                init = { entries ->
                    val builder = ImmutableRangeMap.builder<Distance, Int>()
                    entries.forEach { builder.put(Range.open(it.from, it.to), it.value) }
                    val map = builder.build()
                    distanceRangeMapOf(
                        map.asMapOfRanges().map {
                            RangeMapEntry(it.key.lowerEndpoint(), it.key.upperEndpoint(), it.value)
                        }
                    )
                },
                iteration = {
                    var dummyAcc = 0
                    for (entry in it) dummyAcc += entry.value
                    dummyAcc
                },
            )
        return listOf(ours, immutable, tree, guavaAsConstructor)
    }
}

data class EntryValue(val from: Distance, val to: Distance, val value: Int)

data class TestParams(
    val nMaps: Int,
    val nEntries: Int,
    val iterationCount: Int,
    val initCount: Int,
)

data class RangeMapTest<T>(
    private val name: String,
    private val testParams: TestParams,
    private val init: (List<EntryValue>) -> T,
    private val iteration: (T) -> Int,
) {
    private var maps: MutableList<T> = mutableListOf()
    val initTime: Duration

    init {
        val entries = (1..testParams.nEntries).map { EntryValue(it.meters, (it + 1).meters, it) }
        val totalInitTime = measureTime {
            repeat(testParams.initCount) {
                maps = mutableListOf()
                repeat(testParams.nMaps) { maps.add(init.invoke(entries)) }
            }
        }
        initTime = totalInitTime / (testParams.nMaps * testParams.initCount)
    }

    fun getIterationTime(): Duration {
        val totalTime = measureTime {
            var dummyCounter = 0
            repeat(testParams.iterationCount) {
                for (map in maps) {
                    dummyCounter += iteration.invoke(map)
                }
            }
        }
        return totalTime / (testParams.nMaps * testParams.iterationCount)
    }

    override fun toString(): String {
        return "$name: init: $initTime, iteration: ${getIterationTime()}"
    }
}
