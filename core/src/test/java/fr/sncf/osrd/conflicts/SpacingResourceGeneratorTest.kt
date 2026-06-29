package fr.sncf.osrd.conflicts

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.envelope_sim.SimpleRollingStock
import fr.sncf.osrd.path.implementations.PartialBlockRange
import fr.sncf.osrd.path.implementations.PartialRouteRange
import fr.sncf.osrd.path.implementations.buildRangeList
import fr.sncf.osrd.path.interfaces.BlockRange
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.RouteRange
import fr.sncf.osrd.path.interfaces.ZoneRange
import fr.sncf.osrd.path.interfaces.mapSubObjects
import fr.sncf.osrd.path.interfaces.subRange
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.standalone_sim.CLOSED_SIGNAL_RESERVATION_MARGIN
import fr.sncf.osrd.standalone_sim.EnvelopeStopWrapper
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.Direction.INCREASING
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertNotNull

class SpacingResourceGeneratorTest {
    // See overlapping_routes.py for a detailed infrastructure description
    //
    //      a1.nf                                   b1.nf
    //  |_____>>____                              ____>>______|
    //          ~ ~ \                            / ~ ~ ~ ~ ~ ~
    //      a2.nf    \   center.1    center.3   /   b2.nf
    //  |_____>>______+______>_____>_____>_____+______>>______|
    //                 ~ ~ ~ ~  center.2  ~ ~ ~
    //
    // >>: signal that delimits a route
    // >: signal that doesn't delimit a route
    // There are 4 routes on the middle section: a1->b1, a2->b1, a1->b2, a2->b2
    // The path used in tests is marked with `~`, it uses the route from a1 to b1

    private lateinit var resourceUseOnSingleCall: List<SpacingRequirement>
    private lateinit var blockRanges: List<BlockRange>
    private lateinit var routeRanges: List<RouteRange>
    private lateinit var zoneRanges: List<ZoneRange>
    private val infra = Helpers.fullInfraFromFile("overlapping_routes/infra.json")

    @BeforeEach
    fun setupTests() {
        val allDetectors = infra.rawInfra.detectors
        val detectors =
            listOf(
                allDetectors.first { det ->
                    infra.rawInfra.getDetectorName(det).equals("det.center.2")
                },
                allDetectors.first { det ->
                    infra.rawInfra.getDetectorName(det).equals("det.center.3")
                },
                allDetectors.first { det ->
                    infra.rawInfra.getDetectorName(det).equals("det.b1.nf")
                },
                allDetectors.first { det -> infra.rawInfra.getDetectorName(det).equals("bf.b1") },
            )
        val firstDetector = allDetectors.first { det ->
            infra.rawInfra.getDetectorName(det).equals("det.a1.nf")
        }
        val blocks =
            mutableListOf(
                infra.blockInfra
                    .getBlocksStartingAtDetector(DirDetectorId(firstDetector, INCREASING))[0]
            )
        blocks.addAll(
            detectors.map {
                infra.blockInfra.getBlocksEndingAtDetector(DirDetectorId(it, INCREASING))[0]
            }
        )
        val routes =
            listOf("rt.det.a1.nf->det.b1.nf", "rt.det.b1.nf->bf.b1").map {
                infra.rawInfra.getRouteFromName(it)
            }
        blockRanges =
            buildRangeList(
                blocks.map {
                    val blockLength = infra.blockInfra.getBlockLength(it)
                    PartialBlockRange(it, Offset.zero(), blockLength, blockLength)
                }
            )
        routeRanges =
            buildRangeList(
                routes.map {
                    val routeLength = infra.rawInfra.getRouteLength(it)
                    PartialRouteRange(it, Offset.zero(), routeLength, routeLength)
                }
            )
        zoneRanges =
            blockRanges
                .mapSubObjects(
                    infra.blockInfra::getBlockZonePaths,
                    infra.rawInfra::getZonePathLength,
                )
                .map { it.mapValue(infra.rawInfra.getZonePathZone(it.value)) }
        val length = blockRanges.last().pathEnd
        val spacingResourceGenerator = SpacingResourceGenerator(infra, null)
        spacingResourceGenerator.extendPath(blockRanges, routeRanges, listOf(), true)
        resourceUseOnSingleCall =
            spacingResourceGenerator.processUpdate(makeCallbacks(length, true))!!
    }

    @Test
    fun testDifferentPathLengths() {
        // Only the first block has a simulation (not marked as complete), the path moves forward
        // one block at a time.
        val automaton = SpacingResourceGenerator(infra, null)
        val callbacks = makeCallbacks(blockRanges[0].pathEnd, false)
        val res = mutableListOf<List<SpacingRequirement>?>()
        for (i in blockRanges.indices) {
            val blockRange = blockRanges[i]
            val routeList = routeRanges.subRange(blockRange.pathBegin, blockRange.pathEnd)
            automaton.extendPath(
                listOf(blockRange),
                routeList,
                listOf(),
                isPathComplete = i == blockRanges.lastIndex,
            )
            val iterationResult = automaton.processUpdate(callbacks)
            res.add(iterationResult)
        }
        for (i in res.indices) {
            // We need at least 3 blocks to find a block that doesn't restrict the signal at the end
            // of block 1
            val nBlocks = i + 1
            val expectedNotEnoughPath = nBlocks < 3
            assertEquals(expectedNotEnoughPath, res[i] == null)
        }
    }

    @Test
    fun testWithIncrementalSimulationUpdates() {
        // The path is complete right from the start, the simulation moves forward one block at a
        // time
        val automaton = SpacingResourceGenerator(infra, null)
        automaton.extendPath(blockRanges, routeRanges, listOf(), isPathComplete = true)
        val res = mutableListOf<List<SpacingRequirement>>()
        for (i in blockRanges.indices) {
            val blockRange = blockRanges[i]
            val callbacks = makeCallbacks(blockRange.pathEnd, i == blockRanges.lastIndex)
            val iterationResult = automaton.processUpdate(callbacks)!!
            res.add(iterationResult)
        }

        // Check that the final version of each resource use matches what we get with a single call
        // over the whole path
        val usePerZone = mutableMapOf<ZoneId, SpacingRequirement>()
        for (list in res) for (use in list) usePerZone[use.zone] = use
        val expectedMap = mutableMapOf<ZoneId, SpacingRequirement>()
        for (expected in resourceUseOnSingleCall) expectedMap[expected.zone] = expected
        assertEquals(expectedMap, usePerZone)
    }

    @Test
    fun testWithTinyIncrementalSimulationUpdates() {
        // The path is complete right from the start, the simulation moves forward by tiny
        // increments.
        // This isn't a realistic way to use the API, but it's an easy way to look for incomplete
        // resource use.
        val automaton = SpacingResourceGenerator(infra, null)
        automaton.extendPath(blockRanges, routeRanges, listOf(), isPathComplete = true)
        val res = mutableListOf<List<SpacingRequirement>>()
        for (length in 2500..2510) { // Along the second block, no resource should be freed there
            val callbacks = makeCallbacks(Offset(length.meters), false)
            res.add(automaton.processUpdate(callbacks)!!)
        }
        val partialResources = res[0].filter { !it.isComplete }
        assertTrue { partialResources.isNotEmpty() }

        // Check that all partial updates are present in each call, only diff being a higher end
        // time
        for (i in 1..<res.size) {
            for (partialResource in partialResources) {
                val isPresent =
                    res[i].any {
                        !it.isComplete &&
                            it.zone == partialResource.zone &&
                            it.beginTime == partialResource.beginTime &&
                            it.endTime > partialResource.endTime
                    }
                assertTrue { isPresent }
            }
        }
    }

    @Test
    fun testVeryLongTrain() {
        // The rolling stock is longer than the train path, every resource use should be incomplete
        val length = blockRanges.last().pathEnd - 1.meters
        val callbacks = makeCallbacks(length, false, rollingStock = TestTrains.VERY_LONG_FAST_TRAIN)
        val automaton = SpacingResourceGenerator(infra, null)
        automaton.extendPath(blockRanges, routeRanges, listOf(), isPathComplete = true)
        val res = automaton.processUpdate(callbacks)!!
        for (requirement in res) {
            assertFalse { requirement.isComplete }
            assertEquals(callbacks.currentTime, requirement.endTime)
        }
    }

    @Test
    fun testRequiredPathLength() {
        val automaton = SpacingResourceGenerator(infra, null)
        val callbacks = makeCallbacks(blockRanges[0].pathEnd, false)
        val blockRanges = blockRanges.subList(0, 3)
        val routeRanges = routeRanges.subRange(Offset.zero(), blockRanges.last().pathEnd)
        automaton.extendPath(blockRanges, routeRanges, listOf(), isPathComplete = false)
        val iterationResult = automaton.processUpdate(callbacks)

        // We should have just enough data to generate resource use
        assertNotNull(iterationResult)
    }

    /**
     * The train stops and restarts within sight distance of a signal, with a stop on closed signal.
     */
    @Test
    fun testIncrementalStop() {
        val train = TestTrains.VERY_SHORT_FAST_TRAIN
        val stopDuration = 5_000.0

        // Init stops and offsets
        val stopOffset = blockRanges[2].pathEnd - 50.meters
        val zoneAfterStop = zoneRanges.first { it.pathBegin > stopOffset }.value
        val pathLength = blockRanges.last().pathEnd
        val stops = listOf(TrainStop(stopOffset.meters, stopDuration, SHORT_SLIP_STOP))

        // Build path
        val automaton = SpacingResourceGenerator(infra, null)
        automaton.extendPath(
            blockRanges,
            routeRanges,
            listOf(PathStop(stopOffset, SHORT_SLIP_STOP)),
            isPathComplete = true,
        )

        // Init callbacks, one at the stop and one at the end
        val callbacksAtStop =
            makeCallbacks(stopOffset, false, train, stops, infiniteLastStop = true)
        val fullCallbacks = makeCallbacks(pathLength, true, train, stops, infiniteLastStop = false)

        // Automaton 1: two different calls, at the stop and at the end
        val automaton1 = automaton.clone()
        val incrementalResultAtStop = automaton1.processUpdate(callbacksAtStop)!!
        val incrementalResultAtArrival = automaton1.processUpdate(fullCallbacks)!!

        // For comparison, results with a single call
        val automaton2 = automaton.clone()
        val oneShotResults = automaton2.processUpdate(fullCallbacks)!!
        val stopDepartureTime =
            callbacksAtStop.arrivalTimeInRange(stopOffset, stopOffset) + stopDuration

        // Run assertions on the results
        assert(incrementalResultAtStop.none { it.zone == zoneAfterStop }) {
            "No requirement after the closed signal during the stop"
        }
        assert(incrementalResultAtStop.maxOf { it.endTime } == stopDepartureTime) {
            "We still generate requirements during the full stop duration"
        }
        assert(
            incrementalResultAtArrival.single { it.zone == zoneAfterStop } ==
                oneShotResults.single { it.zone == zoneAfterStop }
        ) {
            "We generate the same requirements after the stop, even with incremental calls"
        }
        assert(
            incrementalResultAtArrival.single { it.zone == zoneAfterStop }.beginTime ==
                stopDepartureTime - CLOSED_SIGNAL_RESERVATION_MARGIN
        ) {
            "We emit the requirement 20s before the departure time"
        }
    }
}

/** Returns an incremental requirement callback of the given length */
private fun makeCallbacks(
    length: Length<PhysicsPath>,
    complete: Boolean,
    rollingStock: PhysicsRollingStock = SimpleRollingStock.STANDARD_TRAIN,
    stops: List<TrainStop> = listOf(),
    infiniteLastStop: Boolean = false,
): IncrementalRequirementCallbacks {
    val envelope =
        Envelope.make(
            EnvelopePart.generateTimes(
                listOf(EnvelopeProfile.CONSTANT_SPEED),
                doubleArrayOf(0.0, length.meters),
                doubleArrayOf(30.0, 30.0),
            )
        )
    val withStops = EnvelopeStopWrapper(envelope, stops)
    return IncrementalRequirementEnvelopeAdapter(
        distanceRangeMapOf(DistanceRangeMap.RangeMapEntry(0.meters, length.distance, rollingStock)),
        withStops,
        complete,
        infiniteLastStop,
    )
}
