package fr.sncf.osrd.stdcm.preprocessing

import fr.sncf.osrd.api.BlockLocationStop
import fr.sncf.osrd.api.ForcedStopType
import fr.sncf.osrd.api.OperationalPointStop
import fr.sncf.osrd.api.StopType
import fr.sncf.osrd.api.stdcm.parseForcedOpStops
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP
import fr.sncf.osrd.sim_infra.api.BlockLocation
import fr.sncf.osrd.stdcm.STDCMCompleteResult
import fr.sncf.osrd.stdcm.STDCMPathfindingBuilder
import fr.sncf.osrd.stdcm.StopTests.Companion.checkStop
import fr.sncf.osrd.stdcm.infra_exploration.ExplorerStep
import fr.sncf.osrd.stdcm.infra_exploration.FORCED_OP_STOP_TIME
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.areSpeedsEqual
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.Test
import kotlin.test.assertEquals
import org.junit.jupiter.api.Assertions

private const val SHORT_STOP_TIME = 50.0
private const val IMPORTANT_STOP_TIME = 50000.0

class ForcedStopsTests {
    @Test
    fun parseForcedOpStopsSmallInfraTests() {
        val infra = Helpers.fullInfraFromFile("small_infra/infra.json")
        val forcedOpStops =
            setOf(
                OperationalPointStop("South_West_station", ForcedStopType.GENERAL_STOP),
                OperationalPointStop("South_station", ForcedStopType.OVERTAKE),
            )
        val actualParseForcedOpStops = parseForcedOpStops(infra, forcedOpStops)
        val expectedParseForcedOpStops =
            setOf(
                BlockLocationStop(
                    BlockLocation(infra.blockInfra.blocks[23], Offset(500.meters)),
                    ForcedStopType.GENERAL_STOP,
                ),
                BlockLocationStop(
                    BlockLocation(infra.blockInfra.blocks[19], Offset(2730.meters)),
                    ForcedStopType.GENERAL_STOP,
                ),
                BlockLocationStop(
                    BlockLocation(infra.blockInfra.blocks[96], Offset(2050.meters)),
                    ForcedStopType.OVERTAKE,
                ),
                BlockLocationStop(
                    BlockLocation(infra.blockInfra.blocks[97], Offset(2200.meters)),
                    ForcedStopType.OVERTAKE,
                ),
            )
        assertEquals(expectedParseForcedOpStops, actualParseForcedOpStops)
    }

    @Test
    fun emptyTimetableWithForcedOpStopOnSecondBlock() {
        /*
        a --> b -(forced op stop)-> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(ExplorerStep(setOf(BlockLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    BlockLocationStop(
                        BlockLocation(secondBlock, Offset(40.meters)),
                        ForcedStopType.GENERAL_STOP,
                    ),
                )
                .run()!!
        val expectedOffset = 140.0

        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult

        // Check that we stop
        Assertions.assertTrue(
            areSpeedsEqual(0.0, resSuccess.envelope.interpolateSpeed(expectedOffset)),
        )

        // Check that the stop is properly returned
        Assertions.assertEquals(
            listOf(
                TrainStop(
                    expectedOffset,
                    FORCED_OP_STOP_TIME,
                    SHORT_SLIP_STOP,
                    StopType.GENERAL_STOP,
                ),
            ),
            resSuccess.stopResults,
        )
    }

    @Test
    fun emptyTimetableWithForcedOpStopOnFirstBlock() {
        /*
        a -(forced op stop)-> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(ExplorerStep(setOf(BlockLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    BlockLocationStop(
                        BlockLocation(firstBlock, Offset(50.meters)),
                        ForcedStopType.GENERAL_STOP,
                    ),
                )
                .run()!!
        val expectedOffset = 50.0

        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult

        // Check that we stop
        Assertions.assertTrue(
            areSpeedsEqual(0.0, resSuccess.envelope.interpolateSpeed(expectedOffset)),
        )

        // Check that the stop is properly returned
        Assertions.assertEquals(
            listOf(
                TrainStop(
                    expectedOffset,
                    FORCED_OP_STOP_TIME,
                    SHORT_SLIP_STOP,
                    StopType.GENERAL_STOP,
                ),
            ),
            resSuccess.stopResults,
        )
    }

    @Test
    fun emptyTimetableWithForcedOpStopOnSecondBlockStart() {
        /*
        a --> b (forced op stop) --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(ExplorerStep(setOf(BlockLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    BlockLocationStop(
                        BlockLocation(secondBlock, Offset(0.meters)),
                        ForcedStopType.GENERAL_STOP,
                    ),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(TrainStop(100.0, FORCED_OP_STOP_TIME, SHORT_SLIP_STOP, StopType.GENERAL_STOP)),
        )
    }

    @Test
    fun emptyTimetableWithForcedOpStopOnFirstBlockEnd() {
        /*
        a --> b (forced op stop) --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(ExplorerStep(setOf(BlockLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    BlockLocationStop(
                        BlockLocation(firstBlock, Offset(100.meters)),
                        ForcedStopType.GENERAL_STOP,
                    ),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(TrainStop(100.0, FORCED_OP_STOP_TIME, SHORT_SLIP_STOP, StopType.GENERAL_STOP)),
        )
    }

    @Test
    fun emptyTimetableWithForcedOpStopOnFirstBlockAndSecondBlock() {
        /*
        a -(forced op stop)-> b -(forced op stop)-> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(ExplorerStep(setOf(BlockLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    BlockLocationStop(
                        BlockLocation(firstBlock, Offset(50.meters)),
                        ForcedStopType.GENERAL_STOP,
                    ),
                )
                .addForcedOpStop(
                    BlockLocationStop(
                        BlockLocation(secondBlock, Offset(50.meters)),
                        ForcedStopType.GENERAL_STOP,
                    ),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(
                TrainStop(50.0, FORCED_OP_STOP_TIME, SHORT_SLIP_STOP, StopType.GENERAL_STOP),
                TrainStop(150.0, FORCED_OP_STOP_TIME, SHORT_SLIP_STOP, StopType.GENERAL_STOP),
            ),
        )
    }

    @Test
    fun emptyTimetableWithMultipleForcedOpStopOnFirstBlock() {
        /*
        a --(forced op stop)--(forced op stop)--> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(ExplorerStep(setOf(BlockLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    BlockLocationStop(
                        BlockLocation(firstBlock, Offset(50.meters)),
                        ForcedStopType.GENERAL_STOP,
                    ),
                )
                .addForcedOpStop(
                    BlockLocationStop(
                        BlockLocation(firstBlock, Offset(80.meters)),
                        ForcedStopType.GENERAL_STOP,
                    ),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(
                TrainStop(50.0, FORCED_OP_STOP_TIME, SHORT_SLIP_STOP, StopType.GENERAL_STOP),
                TrainStop(80.0, FORCED_OP_STOP_TIME, SHORT_SLIP_STOP, StopType.GENERAL_STOP),
            ),
        )
    }

    @Test
    fun emptyTimetableWithForcedOpStopWithHigherStopDurationThanUserStop() {
        /*
        a --(forced op stop > input stop)--> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(ExplorerStep(setOf(BlockLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    ExplorerStep(
                        setOf(BlockLocation(firstBlock, Offset(50.meters))),
                        SHORT_STOP_TIME,
                        true,
                    ),
                )
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    BlockLocationStop(
                        BlockLocation(firstBlock, Offset(50.meters)),
                        ForcedStopType.GENERAL_STOP,
                    ),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(TrainStop(50.0, FORCED_OP_STOP_TIME, SHORT_SLIP_STOP, StopType.INPUT_STOP)),
        )
    }

    @Test
    fun emptyTimetableWithForcedOpStopWithLowerStopDurationThanUserStop() {
        /*
        a --(forced op stop < user stop)--> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(ExplorerStep(setOf(BlockLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    ExplorerStep(
                        setOf(BlockLocation(firstBlock, Offset(50.meters))),
                        IMPORTANT_STOP_TIME,
                        true,
                    ),
                )
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    BlockLocationStop(
                        BlockLocation(firstBlock, Offset(50.meters)),
                        ForcedStopType.GENERAL_STOP,
                    ),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(TrainStop(50.0, IMPORTANT_STOP_TIME, SHORT_SLIP_STOP, StopType.INPUT_STOP)),
        )
    }

    @Test
    fun emptyTimetableWithForcedOpStopWithSameOffsetAndSameTimeAsUserStop() {
        /*
        a --(forced op stop == user stop)--> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(ExplorerStep(setOf(BlockLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    ExplorerStep(
                        setOf(BlockLocation(firstBlock, Offset(50.meters))),
                        FORCED_OP_STOP_TIME,
                        true,
                    ),
                )
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    BlockLocationStop(
                        BlockLocation(firstBlock, Offset(50.meters)),
                        ForcedStopType.GENERAL_STOP,
                    ),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(TrainStop(50.0, FORCED_OP_STOP_TIME, SHORT_SLIP_STOP, StopType.INPUT_STOP)),
        )
    }

    @Test
    fun emptyTimetableWithForcedOpStopAndInputStop() {
        /*
        a --(forced op stop)--(input stop)--> b -(input stop)-> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(ExplorerStep(setOf(BlockLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    ExplorerStep(
                        setOf(BlockLocation(firstBlock, Offset(80.meters))),
                        IMPORTANT_STOP_TIME,
                        true,
                    ),
                )
                .addStep(
                    ExplorerStep(
                        setOf(BlockLocation(secondBlock, Offset(60.meters))),
                        SHORT_STOP_TIME,
                        true,
                    ),
                )
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    BlockLocationStop(
                        BlockLocation(firstBlock, Offset(50.meters)),
                        ForcedStopType.GENERAL_STOP,
                    ),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(
                TrainStop(50.0, FORCED_OP_STOP_TIME, SHORT_SLIP_STOP, StopType.GENERAL_STOP),
                TrainStop(80.0, IMPORTANT_STOP_TIME, SHORT_SLIP_STOP, StopType.INPUT_STOP),
                TrainStop(160.0, SHORT_STOP_TIME, SHORT_SLIP_STOP, StopType.INPUT_STOP),
            ),
        )
    }

    @Test
    fun emptyTimetableWithForcedOpStopInputStopAndOvertake() {
        /*
        a --(forced op stop)--(user stop)--> b -(user stop)--(overtake)--> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(ExplorerStep(setOf(BlockLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    ExplorerStep(
                        setOf(BlockLocation(firstBlock, Offset(80.meters))),
                        IMPORTANT_STOP_TIME,
                        true,
                    ),
                )
                .addStep(
                    ExplorerStep(
                        setOf(BlockLocation(secondBlock, Offset(50.meters))),
                        SHORT_STOP_TIME,
                        true,
                    ),
                )
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    BlockLocationStop(
                        BlockLocation(firstBlock, Offset(50.meters)),
                        ForcedStopType.GENERAL_STOP,
                    ),
                )
                .addForcedOpStop(
                    BlockLocationStop(
                        BlockLocation(secondBlock, Offset(60.meters)),
                        ForcedStopType.OVERTAKE,
                    ),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(
                TrainStop(50.0, FORCED_OP_STOP_TIME, SHORT_SLIP_STOP, StopType.GENERAL_STOP),
                TrainStop(80.0, IMPORTANT_STOP_TIME, SHORT_SLIP_STOP, StopType.INPUT_STOP),
                TrainStop(150.0, SHORT_STOP_TIME, SHORT_SLIP_STOP, StopType.INPUT_STOP),
                TrainStop(160.0, FORCED_OP_STOP_TIME, SHORT_SLIP_STOP, StopType.OVERTAKE),
            ),
        )
    }

    @Test
    fun emptyTimetableWithForcedOpStopAndOvertakeAtSameOffset() {
        /*
        a --(forced op stop == overtake)--> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(ExplorerStep(setOf(BlockLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    BlockLocationStop(
                        BlockLocation(firstBlock, Offset(60.meters)),
                        ForcedStopType.GENERAL_STOP,
                    ),
                )
                .addForcedOpStop(
                    BlockLocationStop(
                        BlockLocation(firstBlock, Offset(60.meters)),
                        ForcedStopType.OVERTAKE,
                    ),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(
                TrainStop(60.0, FORCED_OP_STOP_TIME, SHORT_SLIP_STOP, StopType.GENERAL_STOP),
            ),
        )
    }

    @Test
    fun emptyTimetableWithInputStopAndOvertakeAtSameOffset() {
        /*
        a --(input stop == overtake)--> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(ExplorerStep(setOf(BlockLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    ExplorerStep(
                        setOf(BlockLocation(firstBlock, Offset(60.meters))),
                        FORCED_OP_STOP_TIME,
                        true,
                    ),
                )
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    BlockLocationStop(
                        BlockLocation(firstBlock, Offset(60.meters)),
                        ForcedStopType.OVERTAKE,
                    ),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(
                TrainStop(60.0, FORCED_OP_STOP_TIME, SHORT_SLIP_STOP, StopType.INPUT_STOP),
            ),
        )
    }

    @Test
    fun emptyTimetableWithGeneralStopInputStopAndOvertakeAtSameOffset() {
        /*
        a --(general stop station == input stop == overtake)--> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(ExplorerStep(setOf(BlockLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    ExplorerStep(
                        setOf(BlockLocation(firstBlock, Offset(60.meters))),
                        FORCED_OP_STOP_TIME,
                        true,
                    ),
                )
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    BlockLocationStop(
                        BlockLocation(firstBlock, Offset(60.meters)),
                        ForcedStopType.OVERTAKE,
                    ),
                )
                .addForcedOpStop(
                    BlockLocationStop(
                        BlockLocation(firstBlock, Offset(60.meters)),
                        ForcedStopType.GENERAL_STOP,
                    ),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(
                TrainStop(60.0, FORCED_OP_STOP_TIME, SHORT_SLIP_STOP, StopType.INPUT_STOP),
            ),
        )
    }

    @Test
    fun emptyTimetableWithOvertakeWithHigherStopTimeThanInputStop() {
        /*
        a --(input stop < overtake)--> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(ExplorerStep(setOf(BlockLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    ExplorerStep(
                        setOf(BlockLocation(firstBlock, Offset(60.meters))),
                        SHORT_STOP_TIME,
                        true,
                    ),
                )
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    BlockLocationStop(
                        BlockLocation(firstBlock, Offset(60.meters)),
                        ForcedStopType.OVERTAKE,
                    ),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(
                TrainStop(60.0, FORCED_OP_STOP_TIME, SHORT_SLIP_STOP, StopType.INPUT_STOP),
            ),
        )
    }
    // TODO : Add test with Overtake
    // Input stop type > Forced op stop type > Overtake type
    // time max of 3

    // rebroussement sur forced op stop (vol de test)
}
