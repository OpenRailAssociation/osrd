package fr.sncf.osrd.stdcm.preprocessing

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.areTimesEqual
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.DirDetectorId
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.infra_exploration.initInfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.implementation.makeBlockAvailability
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN
import fr.sncf.osrd.train.TestTrains.VERY_LONG_FAST_TRAIN
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.Double.Companion.POSITIVE_INFINITY
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.junit.jupiter.api.assertThrows

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
            "zone.[bf.b1:DECREASING, det.b1.nf:INCREASING]"
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

    /** Used to filter explorers that are on the right blocks */
    private fun filterExplorer(explorer: InfraExplorerWithEnvelope): Boolean {
        return explorer.getLookahead().all { blocks.contains(it) }
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
                .find { filterExplorer(it) }!!
        while (infraExplorer.getLookahead().size + 1 < nBlocksInPath) infraExplorer =
            infraExplorer.cloneAndExtendLookahead().find { filterExplorer(it) }!!
        for (i in 0 ..< nBlocksSimulated) {
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
            if (i < nBlocksSimulated - 1) infraExplorer.moveForward()
        }
        return infraExplorer
    }

    /** Test that an exception is thrown when there is not enough lookahead */
    @Test
    fun testNotEnoughPath() {
        val explorer = makeExplorer(4, 4)
        val availability = makeBlockAvailability(infra, listOf())
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
        val availability = makeBlockAvailability(infra, listOf())
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
            makeBlockAvailability(
                infra,
                listOf(SpacingRequirement(zoneNames[0], 0.0, duration, true))
            )
        val res =
            availability.getAvailability(
                explorer,
                Offset(0.meters),
                explorer.getSimulatedLength(),
                0.0
            ) as BlockAvailabilityInterface.Unavailable
        assertEquals(duration, res.duration)
    }

    /** Test that we add the right amount of delay if the conflict doesn't start at t=0 */
    @Test
    fun testSimpleDelayNotStartingAt0() {
        val explorer = makeExplorer(5, 1)
        val duration = 120.0
        val availability =
            makeBlockAvailability(
                infra,
                listOf(SpacingRequirement(zoneNames[0], 10.0, duration, true))
            )
        val res =
            availability.getAvailability(
                explorer,
                Offset(0.meters),
                explorer.getSimulatedLength(),
                0.0
            ) as BlockAvailabilityInterface.Unavailable
        assertEquals(duration, res.duration)
    }

    /** Test that the minimum delay does avoid conflicts, even with consecutive occupancies */
    @Test
    fun testConsecutiveOccupancies() {
        val explorer = makeExplorer(5, 1)
        val duration = 1200.0
        val availability =
            makeBlockAvailability(
                infra,
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
        assertEquals(2 * duration, res.duration)
    }

    /** Test that an `Availability` is returned when the path is available */
    @Test
    fun testAvailability() {
        val explorer = makeExplorer(5, 1)
        val startTime = 1200.0
        val availability =
            makeBlockAvailability(
                infra,
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
        assertEquals(startTime, res.timeOfNextConflict)
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
            makeBlockAvailability(
                infra,
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
        assertEquals(minStartTime, res.timeOfNextConflict)
    }

    /** Test that we consider the rolling stock length when evaluating resource use */
    @Test
    fun testRollingStockLength() {
        val explorer = makeExplorer(5, 5, rollingStock = VERY_LONG_FAST_TRAIN)
        val occupancyEnd = 1200.0
        val availability =
            makeBlockAvailability(
                infra,
                listOf(
                    SpacingRequirement(zoneNames[0], 0.0, occupancyEnd, true),
                )
            )

        // The train is so long that it never leaves the first zone
        // We expect a conflict (with the first zone) even on the last meter of the simulation
        assertNotNull(
            availability.getAvailability(
                explorer,
                explorer.getSimulatedLength() - 1.meters,
                explorer.getSimulatedLength(),
                0.0
            ) as? BlockAvailabilityInterface.Unavailable
        )
    }

    /**
     * Test that we can check for availability over the full path, even after partial calls
     * (requires automaton reset)
     */
    @Test
    fun testFullPathAfterPartialCalls() {
        var explorer = makeExplorer(5, 4)
        val occupancyEnd = 6000.0
        val availability =
            makeBlockAvailability(
                infra,
                listOf(
                    SpacingRequirement(zoneNames[0], 0.0, occupancyEnd, true),
                )
            )
        val firstSimEndOffset = explorer.getSimulatedLength()
        availability.getAvailability(explorer, Offset(0.meters), firstSimEndOffset, 0.0)
        explorer.moveForward()
        explorer =
            explorer.addEnvelope(
                Envelope.make(
                    EnvelopePart.generateTimes(
                        listOf(EnvelopeProfile.CONSTANT_SPEED),
                        doubleArrayOf(0.0, blockLengths.last().distance.meters),
                        doubleArrayOf(30.0, 30.0)
                    )
                )
            )
        val res =
            availability.getAvailability(
                explorer,
                Offset(0.meters),
                explorer.getSimulatedLength(),
                0.0
            ) as BlockAvailabilityInterface.Unavailable
        assertEquals(occupancyEnd, res.duration)
    }

    /** Test that we still "use" the first zone, even when checking the conflicts for each block */
    @Test
    fun testPartialResourceUse() {
        var explorer = makeExplorer(5, 1)
        val occupancyEnd = 1200.0
        val availability =
            makeBlockAvailability(
                infra,
                listOf(
                    SpacingRequirement(zoneNames[0], 0.0, occupancyEnd, true),
                )
            )
        val firstSimEndOffset = explorer.getSimulatedLength()
        availability.getAvailability(explorer, Offset(0.meters), firstSimEndOffset, 0.0)
        explorer =
            explorer
                .moveForward()
                .addEnvelope(
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
        assertEquals(occupancyEnd, res.duration)
    }

    /** Test that we can make the same call several times */
    @Test
    fun testRepeatedCalls() {
        val explorer = makeExplorer(5, 5)
        val duration = 120.0
        val availability =
            makeBlockAvailability(
                infra,
                listOf(SpacingRequirement(zoneNames[0], 0.0, duration, true))
            )
        val res1 =
            availability.getAvailability(
                explorer,
                Offset(0.meters),
                explorer.getSimulatedLength(),
                0.0
            ) as BlockAvailabilityInterface.Unavailable
        val res2 =
            availability.getAvailability(
                explorer,
                Offset(0.meters),
                explorer.getSimulatedLength(),
                0.0
            ) as BlockAvailabilityInterface.Unavailable
        assertEquals(res1, res2)
        assertEquals(duration, res1.duration)
    }

    /** Test that we consider the start offset when getting a specific section */
    @Test
    fun testStartOffset() {
        val explorer = makeExplorer(5, 5)
        val availability =
            makeBlockAvailability(
                infra,
                listOf(SpacingRequirement(zoneNames[0], 0.0, POSITIVE_INFINITY, true))
            )
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
            makeBlockAvailability(
                infra,
                listOf(SpacingRequirement(zoneNames.last(), 0.0, POSITIVE_INFINITY, true))
            )
        val res =
            availability.getAvailability(explorer, Offset(0.meters), Offset(1.meters), 0.0)
                as BlockAvailabilityInterface.Available
        assertNotNull(res)
    }

    /** Test that the start time is properly accounted for */
    @Test
    fun testStartTime() {
        val explorer = makeExplorer(5, 1)
        val startTime = 1200.0
        val availability =
            makeBlockAvailability(
                infra,
                listOf(
                    SpacingRequirement(zoneNames[0], 0.0, startTime - 1, true),
                )
            )
        val res =
            availability.getAvailability(
                explorer,
                Offset(0.meters),
                explorer.getSimulatedLength(),
                startTime
            ) as BlockAvailabilityInterface.Available
        assertEquals(POSITIVE_INFINITY, res.maximumDelay)
        assertEquals(POSITIVE_INFINITY, res.timeOfNextConflict)
    }

    /** Test that the start time is properly accounted for with a start offset != 0 */
    @Test
    fun testStartTimeWithStartOffset() {
        val explorer = makeExplorer(5, 5)
        val startTime = 1200.0
        val duration = 120.0
        val availability =
            makeBlockAvailability(
                infra,
                listOf(
                    SpacingRequirement(zoneNames.last(), startTime, startTime + duration, true),
                )
            )
        val res =
            availability.getAvailability(
                explorer,
                explorer.getSimulatedLength() - 100.meters,
                explorer.getSimulatedLength(),
                startTime
            ) as BlockAvailabilityInterface.Unavailable
        assertEquals(duration, res.duration)
    }

    /** Test that we can handle grid margins */
    @Test
    fun testGridMargins() {
        val explorer = makeExplorer(5, 1)
        val marginBefore = 42.0
        val marginAfter = 84.0
        val endFirstConflict = 1200.0
        val startSecondConflict = 6000.0
        val availability =
            makeBlockAvailability(
                infra,
                listOf(
                    SpacingRequirement(zoneNames[0], 0.0, endFirstConflict, true),
                    SpacingRequirement(zoneNames[0], startSecondConflict, POSITIVE_INFINITY, true),
                ),
                marginBefore,
                marginAfter
            )
        val res1 =
            availability.getAvailability(
                explorer,
                Offset(0.meters),
                explorer.getSimulatedLength(),
                0.0
            ) as BlockAvailabilityInterface.Unavailable
        assertEquals(endFirstConflict + marginBefore, res1.duration)

        val startTime = 4000.0
        val res2 =
            availability.getAvailability(
                explorer,
                Offset(0.meters),
                explorer.getSimulatedLength(),
                startTime
            ) as BlockAvailabilityInterface.Available
        assertTrue {
            areTimesEqual(
                startSecondConflict -
                    marginAfter -
                    startTime -
                    explorer.getFullEnvelope().totalTime,
                res2.maximumDelay,
            )
        }
    }

    /**
     * Test that there is no missing conflict after a "not enough lookahead" error. The lookahead
     * problem happens at the end of the path, the conflict is at the beginning
     */
    @Test
    fun testNoMissingConflictAfterNotEnoughLookahead() {
        var explorer = makeExplorer(4, 4)
        val duration = 120.0
        val availability =
            makeBlockAvailability(
                infra,
                listOf(SpacingRequirement(zoneNames[0], 0.0, duration, true))
            )
        assertThrows<BlockAvailabilityInterface.NotEnoughLookaheadError> {
            availability.getAvailability(
                explorer,
                Offset(0.meters),
                explorer.getSimulatedLength(),
                0.0
            )
        }
        explorer =
            explorer
                .cloneAndExtendLookahead()
                .first()
                .moveForward()
                .addEnvelope(
                    Envelope.make(
                        EnvelopePart.generateTimes(
                            listOf(EnvelopeProfile.CONSTANT_SPEED),
                            doubleArrayOf(0.0, blockLengths.last().distance.meters),
                            doubleArrayOf(30.0, 30.0)
                        )
                    )
                )
        val res =
            availability.getAvailability(
                explorer,
                Offset(0.meters),
                explorer.getSimulatedLength(),
                0.0
            ) as BlockAvailabilityInterface.Unavailable
        assertEquals(duration, res.duration)
    }

    /**
     * Test that the travelled path conversion works properly when not starting on the route first
     * block
     */
    @Test
    fun testNotStartingOnRouteFirstBlock() {
        var explorer =
            initInfraExplorerWithEnvelope(
                    infra,
                    PathfindingEdgeLocationId(blocks[2], Offset(50.meters)),
                    listOf(blocks.last()),
                    REALISTIC_FAST_TRAIN
                )
                .first { filterExplorer(it) }
        while (true) {
            val next = explorer.cloneAndExtendLookahead().filter { filterExplorer(it) }
            if (next.isEmpty()) break
            explorer = next.first()
        }
        explorer =
            explorer.addEnvelope(
                Envelope.make(
                    EnvelopePart.generateTimes(
                        listOf(EnvelopeProfile.CONSTANT_SPEED),
                        doubleArrayOf(0.0, 10.0),
                        doubleArrayOf(1.0, 1.0)
                    )
                )
            )
        val availability =
            makeBlockAvailability(
                infra,
                listOf(
                    SpacingRequirement(zoneNames[2], 0.0, 120.0, true),
                )
            )
        val res =
            availability.getAvailability(
                explorer,
                explorer.getIncrementalPath().fromTravelledPath(Offset(0.meters)),
                explorer.getIncrementalPath().fromTravelledPath(Offset(10.meters)),
                0.0
            ) as BlockAvailabilityInterface.Unavailable
        assertEquals(120.0, res.duration)
    }
}
