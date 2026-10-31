package fr.sncf.osrd.stdcm.preprocessing

import fr.sncf.osrd.api.BlockLocationStop
import fr.sncf.osrd.api.ForcedStopType
import fr.sncf.osrd.api.OperationalPointStop
import fr.sncf.osrd.api.StopType
import fr.sncf.osrd.api.stdcm.parseForcedOpStops
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockLocation
import fr.sncf.osrd.stdcm.STDCMCompleteResult
import fr.sncf.osrd.stdcm.STDCMPathfindingBuilder
import fr.sncf.osrd.stdcm.StopTests.Companion.checkStop
import fr.sncf.osrd.stdcm.infra_exploration.ExplorerStep
import fr.sncf.osrd.stdcm.infra_exploration.FORCED_OP_STOP_TIME
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.Test
import kotlin.test.assertEquals
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

private const val SHORT_STOP_TIME = 50.0
private const val IMPORTANT_STOP_TIME = 50000.0

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ForcedStopsTests {
    data class ForcedOpStopLocation(
        val blockId: Int,
        val stopOffset: Offset<Block>,
        val stopType: StopType = StopType.GENERAL_STOP,
    )

    data class StopScenario(
        val stops: List<ForcedOpStopLocation>,
        val expectedStops: List<TrainStop>,
    )

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

    @ParameterizedTest
    @MethodSource("forcedOpStopLocations")
    fun emptyTimetableWithForcedOpStopAndInputStop(stopScenario: StopScenario) {
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val blocks = listOf(firstBlock, secondBlock)
        val stdcmBuilder =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(ExplorerStep(setOf(BlockLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )

        stopScenario.stops.forEach { stop ->
            stdcmBuilder.addForcedOpStop(
                BlockLocationStop(
                    BlockLocation(blocks[stop.blockId], stop.stopOffset),
                    ForcedStopType.GENERAL_STOP,
                ),
            )
        }
        val res = stdcmBuilder.run()!!

        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            stopScenario.expectedStops,
        )
    }

    @ParameterizedTest
    @MethodSource("forcedOpStopsAndInputStopAtSameOffsetParameters")
    fun emptyTimetableWithForcedOpStopAndInputStopAtSameOffset(
        userStopDuration: Double,
        expectedStopDuration: Double,
    ) {
        /*
        a --(forced op stop / input stop)--> b --> c
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
                        userStopDuration,
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
            listOf(TrainStop(50.0, expectedStopDuration, SHORT_SLIP_STOP, StopType.INPUT_STOP)),
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
        a --(forced op stop)--(input stop)--> b -(input stop)--(overtake)--> c
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

    private fun forcedOpStopLocations() =
        listOf(
            /*
            a --(forced op stop)--> b --> c
            */
            Arguments.of(
                StopScenario(
                    stops = listOf(ForcedOpStopLocation(0, Offset(40.0.meters))),
                    expectedStops =
                        listOf(
                            TrainStop(
                                40.0,
                                FORCED_OP_STOP_TIME,
                                SHORT_SLIP_STOP,
                                StopType.GENERAL_STOP,
                            ),
                        ),
                ),
                /*
                a --> b --(forced op stop)--> c
                */
                Arguments.of(
                    StopScenario(
                        stops = listOf(ForcedOpStopLocation(1, Offset(40.0.meters))),
                        expectedStops =
                            listOf(
                                TrainStop(
                                    140.0,
                                    FORCED_OP_STOP_TIME,
                                    SHORT_SLIP_STOP,
                                    StopType.GENERAL_STOP,
                                ),
                            ),
                    ),
                ),
                /*
                a --> b (forced op stop)--> c
                */
                Arguments.of(
                    StopScenario(
                        stops = listOf(ForcedOpStopLocation(1, Offset(0.0.meters))),
                        expectedStops =
                            listOf(
                                TrainStop(
                                    100.0,
                                    FORCED_OP_STOP_TIME,
                                    SHORT_SLIP_STOP,
                                    StopType.GENERAL_STOP,
                                ),
                            ),
                    ),
                ),
                /*
                a --> (forced op stop) b --> c
                */
                Arguments.of(
                    StopScenario(
                        stops = listOf(ForcedOpStopLocation(0, Offset(100.0.meters))),
                        expectedStops =
                            listOf(
                                TrainStop(
                                    100.0,
                                    FORCED_OP_STOP_TIME,
                                    SHORT_SLIP_STOP,
                                    StopType.GENERAL_STOP,
                                ),
                            ),
                    ),
                ),
                /*
                a --(forced op stop)--> b --(forced op stop)--> c
                */
                Arguments.of(
                    StopScenario(
                        stops =
                            listOf(
                                ForcedOpStopLocation(0, Offset(50.0.meters)),
                                ForcedOpStopLocation(1, Offset(50.0.meters)),
                            ),
                        expectedStops =
                            listOf(
                                TrainStop(
                                    50.0,
                                    FORCED_OP_STOP_TIME,
                                    SHORT_SLIP_STOP,
                                    StopType.GENERAL_STOP,
                                ),
                                TrainStop(
                                    150.0,
                                    FORCED_OP_STOP_TIME,
                                    SHORT_SLIP_STOP,
                                    StopType.GENERAL_STOP,
                                ),
                            ),
                    ),
                ),
                /*
                a --(forced op stop)--(forced op stop)--> b --> c
                */
                Arguments.of(
                    StopScenario(
                        stops =
                            listOf(
                                ForcedOpStopLocation(0, Offset(50.0.meters)),
                                ForcedOpStopLocation(0, Offset(80.0.meters)),
                            ),
                        expectedStops =
                            listOf(
                                TrainStop(
                                    50.0,
                                    FORCED_OP_STOP_TIME,
                                    SHORT_SLIP_STOP,
                                    StopType.GENERAL_STOP,
                                ),
                                TrainStop(
                                    80.0,
                                    FORCED_OP_STOP_TIME,
                                    SHORT_SLIP_STOP,
                                    StopType.GENERAL_STOP,
                                ),
                            ),
                    ),
                ),
                /*
                a --(forced op stop == overtake)--> b --> c
                 */
                Arguments.of(
                    StopScenario(
                        stops =
                            listOf(
                                ForcedOpStopLocation(
                                    0,
                                    Offset(50.0.meters),
                                    stopType = StopType.GENERAL_STOP,
                                ),
                                ForcedOpStopLocation(
                                    0,
                                    Offset(50.0.meters),
                                    stopType = StopType.OVERTAKE,
                                ),
                            ),
                        expectedStops =
                            listOf(
                                TrainStop(
                                    50.0,
                                    FORCED_OP_STOP_TIME,
                                    SHORT_SLIP_STOP,
                                    StopType.GENERAL_STOP,
                                ),
                            ),
                    ),
                ),
            ),
        )

    private fun forcedOpStopsAndInputStopAtSameOffsetParameters() =
        listOf(
            // (forced op stop > input stop)
            Arguments.of(SHORT_STOP_TIME, FORCED_OP_STOP_TIME),
            // (forced op stop < input stop)
            Arguments.of(IMPORTANT_STOP_TIME, IMPORTANT_STOP_TIME),
            // (forced op stop == input stop)
            Arguments.of(FORCED_OP_STOP_TIME, FORCED_OP_STOP_TIME),
        )

    // rebroussement sur forced op stop (vol de test)
}
