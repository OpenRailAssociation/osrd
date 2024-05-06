package fr.sncf.osrd.conflicts

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.envelope_sim.SimpleRollingStock
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.DirDetectorId
import fr.sncf.osrd.sim_infra.api.Route
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.Direction.INCREASING
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.toIdxList
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

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

    private lateinit var routes: List<StaticIdx<Route>>
    private lateinit var blockLengths: List<Offset<Block>>
    private lateinit var blocks: MutableList<BlockId>
    private lateinit var resourceUseOnSingleCall: List<SpacingRequirement>
    private val infra =
        Helpers.fullInfraFromRJS(Helpers.getExampleInfra("overlapping_routes/infra.json"))

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
                allDetectors.first { det -> infra.rawInfra.getDetectorName(det).equals("bf.b1") }
            )
        val firstDetector =
            allDetectors.first { det -> infra.rawInfra.getDetectorName(det).equals("det.a1.nf") }
        blocks =
            mutableListOf(
                infra.blockInfra
                    .getBlocksStartingAtDetector(DirDetectorId(firstDetector, INCREASING))[0]
            )
        blocks.addAll(
            detectors.map {
                infra.blockInfra.getBlocksEndingAtDetector(DirDetectorId(it, INCREASING))[0]
            }
        )
        blockLengths = blocks.map { infra.blockInfra.getBlockLength(it) }
        routes =
            listOf(
                    "rt.det.a1.nf->det.b1.nf",
                    "rt.det.b1.nf->bf.b1",
                )
                .map { infra.rawInfra.getRouteFromName(it) }
        val path = incrementalPathOf(infra.rawInfra, infra.blockInfra)
        path.extend(
            PathFragment(
                routes.toIdxList(),
                blocks.toIdxList(),
                stops = listOf(),
                containsStart = true,
                containsEnd = true,
                0.meters,
                0.meters
            )
        )
        val length = Distance(millimeters = blockLengths.sumOf { it.distance.millimeters })
        val automaton =
            SpacingRequirementAutomaton(
                infra.rawInfra,
                infra.loadedSignalInfra,
                infra.blockInfra,
                infra.signalingSimulator,
                makeCallbacks(length, true),
                path
            )
        resourceUseOnSingleCall =
            (automaton.processPathUpdate() as SpacingRequirements).requirements
    }

    @Test
    fun testDifferentPathLengths() {
        // Only the first block has a simulation (not marked as complete), the path moves forward
        // one block at a time.
        val path = incrementalPathOf(infra.rawInfra, infra.blockInfra)
        val automaton =
            SpacingRequirementAutomaton(
                infra.rawInfra,
                infra.loadedSignalInfra,
                infra.blockInfra,
                infra.signalingSimulator,
                makeCallbacks(blockLengths[0].distance, false),
                path
            )
        val res = mutableListOf<SpacingResourceUpdate>()
        for (i in blocks.indices) {
            val block = blocks[i]
            val routeList =
                when (i) {
                    0 -> mutableStaticIdxArrayListOf(routes[0])
                    blocks.size - 1 -> mutableStaticIdxArrayListOf(routes[1])
                    else -> mutableStaticIdxArrayListOf()
                }
            path.extend(
                PathFragment(
                    routeList,
                    mutableStaticIdxArrayListOf(block),
                    stops = listOf(),
                    containsStart = i == 0,
                    containsEnd = i == blocks.size - 1,
                    0.meters,
                    0.meters
                )
            )
            val iterationResult = automaton.processPathUpdate()
            res.add(iterationResult)
        }
        for (i in res.indices) {
            // We need at least 4 blocks to find a block that doesn't restrict the signal at the end
            // of block 1
            val nBlocks = i + 1
            val expectedNotEnoughPath = nBlocks < 4
            assertEquals(expectedNotEnoughPath, res[i] is NotEnoughPath)
        }
    }

    @Test
    fun testWithIncrementalSimulationUpdates() {
        // The path is complete right from the start, the simulation moves forward one block at a
        // time
        val path = incrementalPathOf(infra.rawInfra, infra.blockInfra)
        path.extend(
            PathFragment(
                routes.toIdxList(),
                blocks.toIdxList(),
                stops = listOf(),
                containsStart = true,
                containsEnd = true,
                0.meters,
                0.meters
            )
        )
        val automaton =
            SpacingRequirementAutomaton(
                infra.rawInfra,
                infra.loadedSignalInfra,
                infra.blockInfra,
                infra.signalingSimulator,
                makeCallbacks(blockLengths[0].distance, false),
                path
            )
        val res = mutableListOf<List<SpacingRequirement>>()
        var length = 0.meters
        for (i in blocks.indices) {
            length += blockLengths[i].distance
            automaton.callbacks = makeCallbacks(length, i == blocks.size - 1)
            val iterationResult =
                (automaton.processPathUpdate() as SpacingRequirements).requirements
            res.add(iterationResult)
        }

        // Check that the final version of each resource use matches what we get with a single call
        // over the whole path
        val usePerZone = mutableMapOf<String, SpacingRequirement>()
        for (list in res) for (use in list) usePerZone[use.zone] = use
        val expectedMap = mutableMapOf<String, SpacingRequirement>()
        for (expected in resourceUseOnSingleCall) expectedMap[expected.zone] = expected
        assertEquals(expectedMap, usePerZone)
    }

    @Test
    fun testWithTinyIncrementalSimulationUpdates() {
        // The path is complete right from the start, the simulation moves forward by tiny
        // increments.
        // This isn't a realistic way to use the API, but it's an easy way to look for incomplete
        // resource use.
        val path = incrementalPathOf(infra.rawInfra, infra.blockInfra)
        path.extend(
            PathFragment(
                routes.toIdxList(),
                blocks.toIdxList(),
                stops = listOf(),
                containsStart = true,
                containsEnd = true,
                0.meters,
                0.meters
            )
        )
        val automaton =
            SpacingRequirementAutomaton(
                infra.rawInfra,
                infra.loadedSignalInfra,
                infra.blockInfra,
                infra.signalingSimulator,
                makeCallbacks(blockLengths[0].distance, false),
                path
            )
        val res = mutableListOf<List<SpacingRequirement>>()
        for (length in 2500..2510) { // Along the second block, no resource should be freed there
            automaton.callbacks = makeCallbacks(length.meters, false)
            val iterationResult = (automaton.processPathUpdate() as SpacingRequirements)
            res.add(iterationResult.requirements)
        }
        val partialResources = res[0].filter { !it.isComplete }
        assertTrue { partialResources.isNotEmpty() }

        // Check that all partial updates are present in each call, only diff being a higher end
        // time
        for (i in 1 ..< res.size) {
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
        val path = incrementalPathOf(infra.rawInfra, infra.blockInfra)
        path.extend(
            PathFragment(
                routes.toIdxList(),
                blocks.toIdxList(),
                stops = listOf(),
                containsStart = true,
                containsEnd = true,
                0.meters,
                0.meters
            )
        )
        val length = Distance(blockLengths.sumOf { it.distance.millimeters }) - 1.meters
        val callbacks = makeCallbacks(length, false, rollingStock = TestTrains.VERY_LONG_FAST_TRAIN)
        val automaton =
            SpacingRequirementAutomaton(
                infra.rawInfra,
                infra.loadedSignalInfra,
                infra.blockInfra,
                infra.signalingSimulator,
                callbacks,
                path
            )
        val res = (automaton.processPathUpdate() as SpacingRequirements).requirements
        for (requirement in res) {
            assertFalse { requirement.isComplete }
            assertEquals(automaton.callbacks.currentTime, requirement.endTime)
        }
    }
}

/** Returns an incremental requirement callback of the given length */
private fun makeCallbacks(
    length: Distance,
    complete: Boolean,
    rollingStock: PhysicsRollingStock = SimpleRollingStock.STANDARD_TRAIN
): IncrementalRequirementCallbacks {
    val envelope =
        Envelope.make(
            EnvelopePart.generateTimes(
                listOf(EnvelopeProfile.CONSTANT_SPEED),
                doubleArrayOf(0.0, length.meters),
                doubleArrayOf(30.0, 30.0)
            )
        )
    return IncrementalRequirementEnvelopeAdapter(rollingStock, envelope, complete)
}
