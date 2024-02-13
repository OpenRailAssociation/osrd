package fr.sncf.osrd.stdcm.preprocessing

import fr.sncf.osrd.conflicts.TrainRequirements
import fr.sncf.osrd.conflicts.incrementalConflictDetector
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.DirDetectorId
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.infra_exploration.initInfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.implementation.BlockAvailability
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN
import fr.sncf.osrd.train.TestTrains.VERY_LONG_FAST_TRAIN
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import org.junit.jupiter.api.*
import kotlin.Double.Companion.POSITIVE_INFINITY
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class BlockAvailabilityTests {
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

    private lateinit var blockLengths: List<Offset<Block>>
    private lateinit var blocks: MutableList<BlockId>
    private val infra =
        Helpers.fullInfraFromRJS(Helpers.getExampleInfra("overlapping_routes/infra.json"))
    private val zoneNames =
        listOf(
            "zone.[det.a1.nf:INCREASING, det.a2.nf:INCREASING, det.center.1:DECREASING]",
            "zone.[det.center.1:INCREASING, det.center.2:DECREASING]",
            "zone.[det.center.2:INCREASING, det.center.3:DECREASING]",
            "zone.[det.b1.nf:DECREASING, det.b2.nf:DECREASING, det.center.3:INCREASING]",
            "zone.[det.b1.nf:INCREASING, bf.b1:DECREASING]"
        )

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
                    .getBlocksStartingAtDetector(
                        DirDetectorId(firstDetector, Direction.INCREASING)
                    )[0]
            )
        blocks.addAll(
            detectors.map {
                infra.blockInfra
                    .getBlocksEndingAtDetector(DirDetectorId(it, Direction.INCREASING))[0]
            }
        )
        blockLengths = blocks.map { infra.blockInfra.getBlockLength(it) }
    }

    /**
     * Creates an infra explorer on the infra described above, with at least the given number of
     * blocks in the path, and the given number of simulated blocks. note: the path is always
     * extended until the end of a route.
     */
    private fun makeExplorer(
        nBlocksInPath: Int,
        nBlocksSimulated: Int,
        rollingStock: RollingStock = REALISTIC_FAST_TRAIN
    ): InfraExplorerWithEnvelope {
        assert(nBlocksInPath >= nBlocksSimulated)
        assert(nBlocksInPath <= 5)
        var infraExplorer =
            initInfraExplorerWithEnvelope(
                    infra,
                    PathfindingEdgeLocationId(blocks[0], Offset(0.meters)),
                    listOf(blocks.last()),
                    rollingStock
                )
                .first()
        while (infraExplorer.getLookahead().size + 1 < nBlocksInPath) infraExplorer =
            infraExplorer.cloneAndExtendLookahead().first()
        for (i in 0..nBlocksSimulated) {
            infraExplorer.moveForward()
            infraExplorer =
                infraExplorer.addEnvelope(
                    Envelope.make(
                        EnvelopePart.generateTimes(
                            listOf(EnvelopeProfile.CONSTANT_SPEED),
                            doubleArrayOf(0.0, blockLengths[i].distance.meters),
                            doubleArrayOf(30.0, 30.0)
                        )
                    )
                )
        }
        return infraExplorer
    }

    /** Test that an exception is thrown when there is not enough lookahead */
    @Test
    fun testNotEnoughPath() {
        val explorer = makeExplorer(4, 4)
        val availability = makeAvailability(listOf())
        assertThrows<BlockAvailabilityInterface.NotEnoughLookaheadError> {
            availability.getAvailability(
                explorer,
                Offset(0.meters),
                explorer.getSimulatedLength(),
                0.0
            )
        }
    }

    /** Test that there is enough lookahead on a complete path */
    @Test
    fun testFullPath() {
        val explorer = makeExplorer(5, 5)
        val availability = makeAvailability(listOf())
        assertDoesNotThrow {
            availability.getAvailability(
                explorer,
                Offset(0.meters),
                explorer.getSimulatedLength(),
                0.0
            )
        }
    }

    /** Test that a minimum delay is reported when the first zone is occupied */
    @Test
    fun testSimpleDelay() {
        val explorer = makeExplorer(5, 1)
        val duration = 120.0
        val availability =
            makeAvailability(listOf(SpacingRequirement(zoneNames[0], 0.0, duration, true)))
        val res =
            availability.getAvailability(
                explorer,
                Offset(0.meters),
                explorer.getSimulatedLength(),
                0.0
            ) as BlockAvailabilityInterface.Unavailable
        assertTrue { res.duration > duration }
    }

    /** Test that the minimum delay does avoid conflicts, even with consecutive occupancies */
    @Test
    fun testConsecutiveOccupancies() {
        val explorer = makeExplorer(5, 1)
        val duration = 1200.0
        val availability =
            makeAvailability(
                listOf(
                    SpacingRequirement(zoneNames[0], 0.0, duration - 1, true),
                    SpacingRequirement(zoneNames[0], duration + 1, 2 * duration, true)
                )
            )
        val res =
            availability.getAvailability(
                explorer,
                Offset(0.meters),
                explorer.getSimulatedLength(),
                0.0
            ) as BlockAvailabilityInterface.Unavailable
        assertTrue { res.duration > 2 * duration }
    }

    /** Test that an `Availability` is returned when the path is available */
    @Test
    fun testAvailability() {
        val explorer = makeExplorer(5, 1)
        val startTime = 1200.0
        val availability =
            makeAvailability(
                listOf(
                    SpacingRequirement(zoneNames[0], startTime, POSITIVE_INFINITY, true),
                )
            )
        val res =
            availability.getAvailability(
                explorer,
                Offset(0.meters),
                explorer.getSimulatedLength(),
                0.0
            ) as BlockAvailabilityInterface.Available
        assertTrue { res.maximumDelay <= startTime }
        assertTrue { res.timeOfNextConflict == startTime }
    }

    /**
     * Test that the time of next conflict is the time of the first resource used on the path,
     * ignoring its offset
     */
    @Test
    fun testTimeOfNextConflict() {
        val explorer = makeExplorer(5, 5)
        val minStartTime = 1200.0
        val availability =
            makeAvailability(
                listOf(
                    SpacingRequirement(zoneNames[0], minStartTime + 2, POSITIVE_INFINITY, true),
                    SpacingRequirement(zoneNames[1], minStartTime, POSITIVE_INFINITY, true),
                    SpacingRequirement(zoneNames[2], minStartTime + 1, POSITIVE_INFINITY, true),
                )
            )
        val res =
            availability.getAvailability(
                explorer,
                Offset(0.meters),
                explorer.getSimulatedLength(),
                0.0
            ) as BlockAvailabilityInterface.Available
        assertTrue { res.timeOfNextConflict == minStartTime }
    }

    /** Test that we consider the rolling stock length when evaluating resource use */
    @Test
    fun testRollingStockLength() {
        val explorer = makeExplorer(5, 5, rollingStock = VERY_LONG_FAST_TRAIN)
        val occupancyEnd = 1200.0
        val availability =
            makeAvailability(
                listOf(
                    SpacingRequirement(zoneNames[0], 0.0, occupancyEnd, true),
                )
            )
        val res =
            availability.getAvailability(
                explorer,
                Offset(0.meters),
                explorer.getSimulatedLength(),
                0.0
            ) as BlockAvailabilityInterface.Unavailable

        // The train is so long that it never leaves the first zone
        assertTrue { res.duration == explorer.getFullEnvelope().totalTime }
    }

    /** Test that we still "use" the first zone, even when checking the conflicts for each block */
    @Test
    fun testPartialResourceUse() {
        var explorer = makeExplorer(5, 1)
        val occupancyEnd = 1200.0
        val availability =
            makeAvailability(
                listOf(
                    SpacingRequirement(zoneNames[0], 0.0, occupancyEnd, true),
                )
            )
        val firstSimEndOffset = explorer.getSimulatedLength()
        availability.getAvailability(explorer, Offset(0.meters), firstSimEndOffset, 0.0)
        explorer =
            explorer.addEnvelope(
                Envelope.make(
                    EnvelopePart.generateTimes(
                        listOf(EnvelopeProfile.CONSTANT_SPEED),
                        doubleArrayOf(0.0, blockLengths[1].distance.meters),
                        doubleArrayOf(30.0, 30.0)
                    )
                )
            )
        val res =
            availability.getAvailability(
                explorer,
                firstSimEndOffset,
                explorer.getSimulatedLength(),
                0.0
            ) as BlockAvailabilityInterface.Unavailable
        assertTrue { res.duration >= occupancyEnd }
    }

    /** Test that we can make the same call several times */
    @Test
    fun testRepeatedCalls() {
        val explorer = makeExplorer(5, 5)
        val duration = 120.0
        val availability =
            makeAvailability(listOf(SpacingRequirement(zoneNames[0], 0.0, duration, true)))
        val res1 =
            availability.getAvailability(
                explorer,
                Offset(0.meters),
                explorer.getSimulatedLength(),
                0.0
            )
        val res2 =
            availability.getAvailability(
                explorer,
                Offset(0.meters),
                explorer.getSimulatedLength(),
                0.0
            )
        assertEquals(res1, res2)
    }

    /** Test that we consider the start offset when getting a specific section */
    @Test
    fun testStartOffset() {
        val explorer = makeExplorer(5, 5)
        val availability =
            makeAvailability(listOf(SpacingRequirement(zoneNames[0], 0.0, POSITIVE_INFINITY, true)))
        val res =
            availability.getAvailability(
                explorer,
                explorer.getSimulatedLength() - 1.meters,
                explorer.getSimulatedLength(),
                0.0
            ) as BlockAvailabilityInterface.Available
        assertNotNull(res)
    }

    /** Test that we consider the end offset when getting a specific section */
    @Test
    fun testEndOffset() {
        val explorer = makeExplorer(5, 5)
        val availability =
            makeAvailability(
                listOf(SpacingRequirement(zoneNames.last(), 0.0, POSITIVE_INFINITY, true))
            )
        val res =
            availability.getAvailability(explorer, Offset(0.meters), Offset(1.meters), 0.0)
                as BlockAvailabilityInterface.Available
        assertNotNull(res)
    }

    /** Test that we can handle grid margins */
    @Disabled
    @Test
    fun testGridMargins() {
        TODO("Not currently supported, not even part of the interface yet")
    }

    /** Utility function, creates a block availability function from a list of requirements */
    private fun makeAvailability(
        requirements: List<SpacingRequirement>
    ): BlockAvailabilityInterface {
        val trainRequirements = listOf(TrainRequirements(0L, requirements, listOf()))
        val incrementalConflictDetector = incrementalConflictDetector(trainRequirements)
        return BlockAvailability(infra, incrementalConflictDetector)
    }
}
