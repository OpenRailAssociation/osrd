package fr.sncf.osrd.stdcm.preprocessing

import fr.sncf.osrd.api.ForcedStopType
import fr.sncf.osrd.api.OperationalPointStop
import fr.sncf.osrd.api.StepType
import fr.sncf.osrd.api.stdcm.parseForcedOpStops
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockLocation
import fr.sncf.osrd.stdcm.STDCMCompleteResult
import fr.sncf.osrd.stdcm.STDCMPathfindingBuilder
import fr.sncf.osrd.stdcm.StopTests.Companion.checkStop
import fr.sncf.osrd.stdcm.infra_exploration.ExplorerStep
import fr.sncf.osrd.stdcm.infra_exploration.FORCED_OP_STOP_DURATION
import fr.sncf.osrd.train.TestTrains.VERY_SHORT_FAST_TRAIN
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.seconds
import kotlin.test.Test
import kotlin.test.assertEquals
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

private val SHORT_STOP_DURATION = 50.seconds
private val LONG_STOP_DURATION = 50000.seconds

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ForcedStopsTests {
    data class ForcedOpStopLocation(
        val blockId: Int,
        val blockOffset: Offset<Block>,
        val stepTypes: Set<StepType> = setOf(StepType.INFRA_FORCED_STOP),
    )

    data class StopScenario(
        val forcedStops: List<ForcedOpStopLocation>,
        val expectedPathStops: List<TrainStop>,
    )

    @Test
    fun parseForcedOpStopsSmallInfraTests() {
        val infra = Helpers.fullInfraFromFile("small_infra/infra.json")
        val forcedOpStops =
            setOf(
                OperationalPointStop("South_West_station", ForcedStopType.GENERAL_STOP),
                OperationalPointStop("South_station", ForcedStopType.OVERTAKE),
            )
        val actualParseForcedOpStops = parseForcedOpStops(infra, forcedOpStops).toList()
        val expectedParseForcedOpStops =
            listOf(
                createForcedOpStopExplorerStep(
                    BlockLocation(infra.blockInfra.blocks[23], Offset(500.meters)),
                    setOf(StepType.INFRA_FORCED_STOP),
                ),
                createForcedOpStopExplorerStep(
                    BlockLocation(infra.blockInfra.blocks[19], Offset(2730.meters)),
                    setOf(StepType.INFRA_FORCED_STOP),
                ),
                createForcedOpStopExplorerStep(
                    BlockLocation(infra.blockInfra.blocks[96], Offset(2050.meters)),
                    setOf(StepType.INFRA_OVERTAKE_STOP),
                ),
                createForcedOpStopExplorerStep(
                    BlockLocation(infra.blockInfra.blocks[97], Offset(2200.meters)),
                    setOf(StepType.INFRA_OVERTAKE_STOP),
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
                .setStartLocations(setOf(BlockLocation(firstBlock, Offset(0.meters))))

        stopScenario.forcedStops.forEach { stop ->
            stdcmBuilder.addForcedOpStop(
                createForcedOpStopExplorerStep(
                    BlockLocation(blocks[stop.blockId], stop.blockOffset),
                    stop.stepTypes,
                ),
            )
        }
        val res =
            stdcmBuilder
                .setEndLocations(
                    setOf(BlockLocation(secondBlock, Offset(100.meters))),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            stopScenario.expectedPathStops,
        )
    }

    private fun forcedOpStopLocations() =
        listOf(
            /*
            a --(forced stop)--> b --> c
            */
            Arguments.of(
                StopScenario(
                    forcedStops = listOf(ForcedOpStopLocation(0, Offset(40.0.meters))),
                    expectedPathStops =
                        listOf(
                            TrainStop(
                                40.0,
                                FORCED_OP_STOP_DURATION.seconds,
                                SHORT_SLIP_STOP,
                                setOf(StepType.INFRA_FORCED_STOP),
                            ),
                        ),
                ),
                /*
                a --> b --(forced stop)--> c
                */
                Arguments.of(
                    StopScenario(
                        forcedStops = listOf(ForcedOpStopLocation(1, Offset(40.0.meters))),
                        expectedPathStops =
                            listOf(
                                TrainStop(
                                    140.0,
                                    FORCED_OP_STOP_DURATION.seconds,
                                    SHORT_SLIP_STOP,
                                    setOf(StepType.INFRA_FORCED_STOP),
                                ),
                            ),
                    ),
                ),
                /*
                a --> b (forced stop)--> c
                */
                Arguments.of(
                    StopScenario(
                        forcedStops = listOf(ForcedOpStopLocation(1, Offset(0.0.meters))),
                        expectedPathStops =
                            listOf(
                                TrainStop(
                                    100.0,
                                    FORCED_OP_STOP_DURATION.seconds,
                                    SHORT_SLIP_STOP,
                                    setOf(StepType.INFRA_FORCED_STOP),
                                ),
                            ),
                    ),
                ),
                /*
                a --> (forced stop) b --> c
                */
                Arguments.of(
                    StopScenario(
                        forcedStops = listOf(ForcedOpStopLocation(0, Offset(100.0.meters))),
                        expectedPathStops =
                            listOf(
                                TrainStop(
                                    100.0,
                                    FORCED_OP_STOP_DURATION.seconds,
                                    SHORT_SLIP_STOP,
                                    setOf(StepType.INFRA_FORCED_STOP),
                                ),
                            ),
                    ),
                ),
                /*
                a --(forced stop)--> b --(forced stop)--> c
                */
                Arguments.of(
                    StopScenario(
                        forcedStops =
                            listOf(
                                ForcedOpStopLocation(0, Offset(50.0.meters)),
                                ForcedOpStopLocation(1, Offset(50.0.meters)),
                            ),
                        expectedPathStops =
                            listOf(
                                TrainStop(
                                    50.0,
                                    FORCED_OP_STOP_DURATION.seconds,
                                    SHORT_SLIP_STOP,
                                    setOf(StepType.INFRA_FORCED_STOP),
                                ),
                                TrainStop(
                                    150.0,
                                    FORCED_OP_STOP_DURATION.seconds,
                                    SHORT_SLIP_STOP,
                                    setOf(StepType.INFRA_FORCED_STOP),
                                ),
                            ),
                    ),
                ),
                /*
                a --(forced stop)--(forced stop)--> b --> c
                */
                Arguments.of(
                    StopScenario(
                        forcedStops =
                            listOf(
                                ForcedOpStopLocation(0, Offset(50.0.meters)),
                                ForcedOpStopLocation(0, Offset(80.0.meters)),
                            ),
                        expectedPathStops =
                            listOf(
                                TrainStop(
                                    50.0,
                                    FORCED_OP_STOP_DURATION.seconds,
                                    SHORT_SLIP_STOP,
                                    setOf(StepType.INFRA_FORCED_STOP),
                                ),
                                TrainStop(
                                    80.0,
                                    FORCED_OP_STOP_DURATION.seconds,
                                    SHORT_SLIP_STOP,
                                    setOf(StepType.INFRA_FORCED_STOP),
                                ),
                            ),
                    ),
                ),
                /*
                a --(forced stop == overtake)--> b --> c
                 */
                Arguments.of(
                    StopScenario(
                        forcedStops =
                            listOf(
                                ForcedOpStopLocation(
                                    0,
                                    Offset(50.0.meters),
                                    stepTypes = setOf(StepType.INFRA_FORCED_STOP),
                                ),
                                ForcedOpStopLocation(
                                    0,
                                    Offset(50.0.meters),
                                    stepTypes = setOf(StepType.INFRA_OVERTAKE_STOP),
                                ),
                            ),
                        expectedPathStops =
                            listOf(
                                TrainStop(
                                    50.0,
                                    FORCED_OP_STOP_DURATION.seconds,
                                    SHORT_SLIP_STOP,
                                    setOf(StepType.INFRA_FORCED_STOP),
                                ),
                            ),
                    ),
                ),
            ),
        )

    @ParameterizedTest
    @MethodSource("forcedOpStopsAndInputStopAtSameOffsetParameters")
    fun emptyTimetableWithForcedOpStopAndInputStopAtSameOffset(
        inputStopDuration: Double,
        expectedStopDuration: Double,
        forcedOpStopType: StepType,
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
                .setStartLocations(setOf(BlockLocation(firstBlock, Offset(0.meters))))
                .addStep(
                    ExplorerStep(
                        locations = setOf(BlockLocation(firstBlock, Offset(50.meters))),
                        duration = inputStopDuration,
                        canBacktrack = true,
                        inputStepIndex = 1,
                    ),
                )
                .addForcedOpStop(
                    createForcedOpStopExplorerStep(
                        BlockLocation(firstBlock, Offset(50.meters)),
                        setOf(forcedOpStopType),
                    ),
                )
                .setEndLocations(
                    setOf(BlockLocation(secondBlock, Offset(100.meters))),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(
                TrainStop(
                    50.0,
                    expectedStopDuration,
                    SHORT_SLIP_STOP,
                    setOf(StepType.INPUT_STOP, forcedOpStopType),
                ),
            ),
        )
    }

    private fun forcedOpStopsAndInputStopAtSameOffsetParameters() =
        listOf(
            // (forced stop > input stop)
            Arguments.of(
                SHORT_STOP_DURATION.seconds,
                FORCED_OP_STOP_DURATION.seconds,
                StepType.INFRA_FORCED_STOP,
            ),
            // (forced stop < input stop)
            Arguments.of(
                LONG_STOP_DURATION.seconds,
                LONG_STOP_DURATION.seconds,
                StepType.INFRA_FORCED_STOP,
            ),
            // (forced stop == input stop)
            Arguments.of(
                FORCED_OP_STOP_DURATION.seconds,
                FORCED_OP_STOP_DURATION.seconds,
                StepType.INFRA_FORCED_STOP,
            ),
            // (overtake > input stop)
            Arguments.of(
                SHORT_STOP_DURATION.seconds,
                FORCED_OP_STOP_DURATION.seconds,
                StepType.INFRA_OVERTAKE_STOP,
            ),
            // (overtake < input stop)
            Arguments.of(
                LONG_STOP_DURATION.seconds,
                LONG_STOP_DURATION.seconds,
                StepType.INFRA_OVERTAKE_STOP,
            ),
            // (overtake == input stop)
            Arguments.of(
                FORCED_OP_STOP_DURATION.seconds,
                FORCED_OP_STOP_DURATION.seconds,
                StepType.INFRA_OVERTAKE_STOP,
            ),
        )

    @Test
    fun emptyTimetableWithForcedOpStopAndInputStop() {
        /*
        a --(forced stop)--(input stop)--> b -(input stop)-> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(BlockLocation(firstBlock, Offset(0.meters))))
                .addForcedOpStop(
                    createForcedOpStopExplorerStep(
                        BlockLocation(firstBlock, Offset(50.meters)),
                        setOf(StepType.INFRA_FORCED_STOP),
                    ),
                )
                .addStep(
                    ExplorerStep(
                        locations = setOf(BlockLocation(firstBlock, Offset(80.meters))),
                        duration = LONG_STOP_DURATION.seconds,
                        canBacktrack = true,
                        inputStepIndex = 1,
                    ),
                )
                .addStep(
                    ExplorerStep(
                        locations = setOf(BlockLocation(secondBlock, Offset(60.meters))),
                        duration = SHORT_STOP_DURATION.seconds,
                        canBacktrack = true,
                        inputStepIndex = 2,
                    ),
                )
                .setEndLocations(
                    setOf(BlockLocation(secondBlock, Offset(100.meters))),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(
                TrainStop(
                    50.0,
                    FORCED_OP_STOP_DURATION.seconds,
                    SHORT_SLIP_STOP,
                    setOf(StepType.INFRA_FORCED_STOP),
                ),
                TrainStop(
                    80.0,
                    LONG_STOP_DURATION.seconds,
                    SHORT_SLIP_STOP,
                    setOf(StepType.INPUT_STOP),
                ),
                TrainStop(
                    160.0,
                    SHORT_STOP_DURATION.seconds,
                    SHORT_SLIP_STOP,
                    setOf(StepType.INPUT_STOP),
                ),
            ),
        )
    }

    @Test
    fun emptyTimetableWithForcedOpStopInputStopAndOvertake() {
        /*
        a --(forced stop)--(input stop)--> b -(input stop)--(overtake)--> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(BlockLocation(firstBlock, Offset(0.meters))))
                .addForcedOpStop(
                    createForcedOpStopExplorerStep(
                        BlockLocation(firstBlock, Offset(50.meters)),
                        setOf(StepType.INFRA_FORCED_STOP),
                    ),
                )
                .addStep(
                    ExplorerStep(
                        locations = setOf(BlockLocation(firstBlock, Offset(80.meters))),
                        duration = LONG_STOP_DURATION.seconds,
                        canBacktrack = true,
                        inputStepIndex = 1,
                    ),
                )
                .addStep(
                    ExplorerStep(
                        locations = setOf(BlockLocation(secondBlock, Offset(50.meters))),
                        duration = SHORT_STOP_DURATION.seconds,
                        canBacktrack = true,
                        inputStepIndex = 2,
                    ),
                )
                .addForcedOpStop(
                    createForcedOpStopExplorerStep(
                        BlockLocation(secondBlock, Offset(60.meters)),
                        setOf(StepType.INFRA_OVERTAKE_STOP),
                    ),
                )
                .setEndLocations(
                    setOf(BlockLocation(secondBlock, Offset(100.meters))),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(
                TrainStop(
                    50.0,
                    FORCED_OP_STOP_DURATION.seconds,
                    SHORT_SLIP_STOP,
                    setOf(StepType.INFRA_FORCED_STOP),
                ),
                TrainStop(
                    80.0,
                    LONG_STOP_DURATION.seconds,
                    SHORT_SLIP_STOP,
                    setOf(StepType.INPUT_STOP),
                ),
                TrainStop(
                    150.0,
                    SHORT_STOP_DURATION.seconds,
                    SHORT_SLIP_STOP,
                    setOf(StepType.INPUT_STOP),
                ),
                TrainStop(
                    160.0,
                    FORCED_OP_STOP_DURATION.seconds,
                    SHORT_SLIP_STOP,
                    setOf(StepType.INFRA_OVERTAKE_STOP),
                ),
            ),
        )
    }

    @Test
    fun emptyTimetableWithGeneralStopInputStopAndOvertakeAtSameOffset() {
        /*
        a --(forced stop station == input stop == overtake)--> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(BlockLocation(firstBlock, Offset(0.meters))))
                .addStep(
                    ExplorerStep(
                        locations = setOf(BlockLocation(firstBlock, Offset(60.meters))),
                        duration = FORCED_OP_STOP_DURATION.seconds,
                        canBacktrack = true,
                        inputStepIndex = 1,
                    ),
                )
                .addForcedOpStop(
                    createForcedOpStopExplorerStep(
                        BlockLocation(firstBlock, Offset(60.meters)),
                        setOf(StepType.INFRA_OVERTAKE_STOP),
                    ),
                )
                .addForcedOpStop(
                    createForcedOpStopExplorerStep(
                        BlockLocation(firstBlock, Offset(60.meters)),
                        setOf(StepType.INFRA_FORCED_STOP),
                    ),
                )
                .setEndLocations(
                    setOf(BlockLocation(secondBlock, Offset(100.meters))),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(
                TrainStop(
                    60.0,
                    FORCED_OP_STOP_DURATION.seconds,
                    SHORT_SLIP_STOP,
                    setOf(
                        StepType.INPUT_STOP,
                        StepType.INFRA_FORCED_STOP,
                        StepType.INFRA_OVERTAKE_STOP,
                    ),
                ),
            ),
        )
    }

    @Test
    fun emptyTimetableWithForcedOpStopAtDestination() {
        /*
        a --> b --> c (forced stop)
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(BlockLocation(firstBlock, Offset(0.meters))))
                .addForcedOpStop(
                    createForcedOpStopExplorerStep(
                        BlockLocation(secondBlock, Offset(100.meters)),
                        setOf(StepType.INFRA_FORCED_STOP),
                    ),
                )
                .setEndLocations(
                    setOf(BlockLocation(secondBlock, Offset(100.meters))),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(),
        )
    }

    @Test
    fun emptyTimetableWithForcedOpStopAndBacktracking() {
        /*
        a -- (forced stop && backtracking) --> b
         */
        val infra = DummyInfra()
        val ab = infra.addBlock("a", "b")
        val bc = infra.addBlock("b", "c")
        val cb = infra.addBlock("c2", "b2", oppositeOf = bc)
        val ba = infra.addBlock("b2", "a2", oppositeOf = ab)
        val res =
            STDCMPathfindingBuilder()
                .setRollingStocks(listOf(VERY_SHORT_FAST_TRAIN))
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(BlockLocation(ab, Offset(30.meters))))
                .addStep(
                    ExplorerStep(
                        locations =
                            setOf(
                                BlockLocation(bc, Offset(50.meters)),
                                BlockLocation(cb, Offset(50.meters)),
                            ),
                        duration = SHORT_STOP_DURATION.seconds,
                        canBacktrack = true,
                        inputStepIndex = 1,
                    ),
                )
                .addForcedOpStop(
                    createForcedOpStopExplorerStep(BlockLocation(bc, Offset(50.meters))),
                )
                .setEndLocations(
                    setOf(BlockLocation(ba, Offset(20.meters))),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        Assertions.assertTrue(res.backtrackIndexes.size == 1 && res.backtrackIndexes[0] == 1)
        checkStop(
            resSuccess,
            listOf(
                TrainStop(
                    120.0,
                    FORCED_OP_STOP_DURATION.seconds,
                    SHORT_SLIP_STOP,
                    setOf(StepType.INPUT_STOP, StepType.INFRA_FORCED_STOP),
                ),
            ),
        )
    }

    private fun createForcedOpStopExplorerStep(
        blockLocation: BlockLocation,
        stepTypes: Set<StepType> = setOf(StepType.INFRA_FORCED_STOP),
    ): ExplorerStep {
        return ExplorerStep(
            setOf(blockLocation),
            FORCED_OP_STOP_DURATION.seconds,
            stepTypes = stepTypes,
        )
    }
}
