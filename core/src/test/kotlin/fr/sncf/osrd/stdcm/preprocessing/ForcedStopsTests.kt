package fr.sncf.osrd.stdcm.preprocessing

import com.google.common.collect.ImmutableMultimap
import fr.sncf.osrd.api.ForcedStopType
import fr.sncf.osrd.api.OperationalPointStop
import fr.sncf.osrd.api.StepType
import fr.sncf.osrd.api.stdcm.parseForcedOpStops
import fr.sncf.osrd.envelope_sim.Comfort
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockLocation
import fr.sncf.osrd.stdcm.STDCMCompleteResult
import fr.sncf.osrd.stdcm.STDCMPathfindingBuilder
import fr.sncf.osrd.stdcm.StopTests.Companion.checkStop
import fr.sncf.osrd.stdcm.infraExplorerFromBlock
import fr.sncf.osrd.stdcm.infra_exploration.ExplorerStep
import fr.sncf.osrd.stdcm.infra_exploration.FORCED_OP_STOP_DURATION
import fr.sncf.osrd.stdcm.occupancyTest
import fr.sncf.osrd.stdcm.simulateBlock
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.time.Duration.Companion.seconds
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
        val stepTypes: Set<StepType> = setOf(StepType.GENERAL_STOP),
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
                    setOf(StepType.GENERAL_STOP),
                ),
                createForcedOpStopExplorerStep(
                    BlockLocation(infra.blockInfra.blocks[19], Offset(2730.meters)),
                    setOf(StepType.GENERAL_STOP),
                ),
                createForcedOpStopExplorerStep(
                    BlockLocation(infra.blockInfra.blocks[96], Offset(2050.meters)),
                    setOf(StepType.OVERTAKE),
                ),
                createForcedOpStopExplorerStep(
                    BlockLocation(infra.blockInfra.blocks[97], Offset(2200.meters)),
                    setOf(StepType.OVERTAKE),
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

        stopScenario.forcedStops.forEach { stop ->
            stdcmBuilder.addForcedOpStop(
                createForcedOpStopExplorerStep(
                    BlockLocation(blocks[stop.blockId], stop.blockOffset),
                    stop.stepTypes,
                ),
            )
        }
        val res = stdcmBuilder.run()!!
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
            a --(general stop)--> b --> c
            */
            Arguments.of(
                StopScenario(
                    forcedStops = listOf(ForcedOpStopLocation(0, Offset(40.0.meters))),
                    expectedPathStops =
                        listOf(
                            TrainStop(
                                40.0,
                                FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
                                SHORT_SLIP_STOP,
                                setOf(StepType.GENERAL_STOP),
                            ),
                        ),
                ),
                /*
                a --> b --(general stop)--> c
                */
                Arguments.of(
                    StopScenario(
                        forcedStops = listOf(ForcedOpStopLocation(1, Offset(40.0.meters))),
                        expectedPathStops =
                            listOf(
                                TrainStop(
                                    140.0,
                                    FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
                                    SHORT_SLIP_STOP,
                                    setOf(StepType.GENERAL_STOP),
                                ),
                            ),
                    ),
                ),
                /*
                a --> b (general stop)--> c
                */
                Arguments.of(
                    StopScenario(
                        forcedStops = listOf(ForcedOpStopLocation(1, Offset(0.0.meters))),
                        expectedPathStops =
                            listOf(
                                TrainStop(
                                    100.0,
                                    FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
                                    SHORT_SLIP_STOP,
                                    setOf(StepType.GENERAL_STOP),
                                ),
                            ),
                    ),
                ),
                /*
                a --> (general stop) b --> c
                */
                Arguments.of(
                    StopScenario(
                        forcedStops = listOf(ForcedOpStopLocation(0, Offset(100.0.meters))),
                        expectedPathStops =
                            listOf(
                                TrainStop(
                                    100.0,
                                    FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
                                    SHORT_SLIP_STOP,
                                    setOf(StepType.GENERAL_STOP),
                                ),
                            ),
                    ),
                ),
                /*
                a --(general stop)--> b --(general stop)--> c
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
                                    FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
                                    SHORT_SLIP_STOP,
                                    setOf(StepType.GENERAL_STOP),
                                ),
                                TrainStop(
                                    150.0,
                                    FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
                                    SHORT_SLIP_STOP,
                                    setOf(StepType.GENERAL_STOP),
                                ),
                            ),
                    ),
                ),
                /*
                a --(general stop)--(general stop)--> b --> c
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
                                    FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
                                    SHORT_SLIP_STOP,
                                    setOf(StepType.GENERAL_STOP),
                                ),
                                TrainStop(
                                    80.0,
                                    FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
                                    SHORT_SLIP_STOP,
                                    setOf(StepType.GENERAL_STOP),
                                ),
                            ),
                    ),
                ),
                /*
                a --(general stop == overtake)--> b --> c
                For the case where there is an overtake on the same OP as a General Stop Station, the General Stop as a higher priority than the overtake
                We should always see that the stop is a General Stop Station and keep the higher stop time (for now it's the same stop time)
                 */
                Arguments.of(
                    StopScenario(
                        forcedStops =
                            listOf(
                                ForcedOpStopLocation(
                                    0,
                                    Offset(50.0.meters),
                                    stepTypes = setOf(StepType.GENERAL_STOP),
                                ),
                                ForcedOpStopLocation(
                                    0,
                                    Offset(50.0.meters),
                                    stepTypes = setOf(StepType.OVERTAKE),
                                ),
                            ),
                        expectedPathStops =
                            listOf(
                                TrainStop(
                                    50.0,
                                    FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
                                    SHORT_SLIP_STOP,
                                    setOf(StepType.GENERAL_STOP),
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
    ) {
        /*
        a --(general stop / input stop)--> b --> c
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
                        inputStopDuration,
                        true,
                    ),
                )
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    createForcedOpStopExplorerStep(
                        BlockLocation(firstBlock, Offset(50.meters)),
                        setOf(StepType.GENERAL_STOP),
                    ),
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
                    setOf(StepType.INPUT_STOP, StepType.GENERAL_STOP),
                ),
            ),
        )
    }

    private fun forcedOpStopsAndInputStopAtSameOffsetParameters() =
        listOf(
            // (general stop > input stop)
            Arguments.of(
                SHORT_STOP_DURATION.inWholeSeconds.toDouble(),
                FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
            ),
            // (general stop < input stop)
            Arguments.of(
                LONG_STOP_DURATION.inWholeSeconds.toDouble(),
                LONG_STOP_DURATION.inWholeSeconds.toDouble(),
            ),
            // (general stop == input stop)
            Arguments.of(
                FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
                FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
            ),
        )

    @Test
    fun emptyTimetableWithForcedOpStopAndInputStop() {
        /*
        a --(general stop)--(input stop)--> b -(input stop)-> c
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
                        LONG_STOP_DURATION.inWholeSeconds.toDouble(),
                        true,
                    ),
                )
                .addStep(
                    ExplorerStep(
                        setOf(BlockLocation(secondBlock, Offset(60.meters))),
                        SHORT_STOP_DURATION.inWholeSeconds.toDouble(),
                        true,
                    ),
                )
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    createForcedOpStopExplorerStep(
                        BlockLocation(firstBlock, Offset(50.meters)),
                        setOf(StepType.GENERAL_STOP),
                    ),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(
                TrainStop(
                    50.0,
                    FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
                    SHORT_SLIP_STOP,
                    setOf(StepType.GENERAL_STOP),
                ),
                TrainStop(
                    80.0,
                    LONG_STOP_DURATION.inWholeSeconds.toDouble(),
                    SHORT_SLIP_STOP,
                    setOf(StepType.INPUT_STOP),
                ),
                TrainStop(
                    160.0,
                    SHORT_STOP_DURATION.inWholeSeconds.toDouble(),
                    SHORT_SLIP_STOP,
                    setOf(StepType.INPUT_STOP),
                ),
            ),
        )
    }

    @Test
    fun emptyTimetableWithForcedOpStopInputStopAndOvertake() {
        /*
        a --(general stop)--(input stop)--> b -(input stop)--(overtake)--> c
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
                        LONG_STOP_DURATION.inWholeSeconds.toDouble(),
                        true,
                    ),
                )
                .addStep(
                    ExplorerStep(
                        setOf(BlockLocation(secondBlock, Offset(50.meters))),
                        SHORT_STOP_DURATION.inWholeSeconds.toDouble(),
                        true,
                    ),
                )
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    createForcedOpStopExplorerStep(
                        BlockLocation(firstBlock, Offset(50.meters)),
                        setOf(StepType.GENERAL_STOP),
                    ),
                )
                .addForcedOpStop(
                    createForcedOpStopExplorerStep(
                        BlockLocation(secondBlock, Offset(60.meters)),
                        setOf(StepType.OVERTAKE),
                    ),
                )
        val toto = res.run()!!
        Assertions.assertTrue(toto is STDCMCompleteResult)
        val resSuccess = toto as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(
                TrainStop(
                    50.0,
                    FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
                    SHORT_SLIP_STOP,
                    setOf(StepType.GENERAL_STOP),
                ),
                TrainStop(
                    80.0,
                    LONG_STOP_DURATION.inWholeSeconds.toDouble(),
                    SHORT_SLIP_STOP,
                    setOf(StepType.INPUT_STOP),
                ),
                TrainStop(
                    150.0,
                    SHORT_STOP_DURATION.inWholeSeconds.toDouble(),
                    SHORT_SLIP_STOP,
                    setOf(StepType.INPUT_STOP),
                ),
                TrainStop(
                    160.0,
                    FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
                    SHORT_SLIP_STOP,
                    setOf(StepType.OVERTAKE),
                ),
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
                        FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
                        true,
                    ),
                )
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    createForcedOpStopExplorerStep(
                        BlockLocation(firstBlock, Offset(60.meters)),
                        setOf(StepType.OVERTAKE),
                    ),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(
                TrainStop(
                    60.0,
                    FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
                    SHORT_SLIP_STOP,
                    setOf(StepType.INPUT_STOP, StepType.OVERTAKE),
                ),
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
                        FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
                        true,
                    ),
                )
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    createForcedOpStopExplorerStep(
                        BlockLocation(firstBlock, Offset(60.meters)),
                        setOf(StepType.OVERTAKE),
                    ),
                )
                .addForcedOpStop(
                    createForcedOpStopExplorerStep(
                        BlockLocation(firstBlock, Offset(60.meters)),
                        setOf(StepType.GENERAL_STOP),
                    ),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(
                TrainStop(
                    60.0,
                    FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
                    SHORT_SLIP_STOP,
                    setOf(StepType.INPUT_STOP, StepType.GENERAL_STOP, StepType.OVERTAKE),
                ),
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
                        SHORT_STOP_DURATION.inWholeSeconds.toDouble(),
                        true,
                    ),
                )
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    createForcedOpStopExplorerStep(
                        BlockLocation(firstBlock, Offset(60.meters)),
                        setOf(StepType.OVERTAKE),
                    ),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(
                TrainStop(
                    60.0,
                    FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
                    SHORT_SLIP_STOP,
                    setOf(StepType.INPUT_STOP, StepType.OVERTAKE),
                ),
            ),
        )
    }

    @Test
    fun emptyTimetableWithForcedOpStopAtDestination() {
        /*
        a --> b --> c (general stop)
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
                    createForcedOpStopExplorerStep(
                        BlockLocation(secondBlock, Offset(100.meters)),
                        setOf(StepType.GENERAL_STOP),
                    ),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        checkStop(
            resSuccess,
            listOf(),
        )
    }

    private fun createForcedOpStopExplorerStep(
        blockLocation: BlockLocation,
        stepTypes: Set<StepType> = setOf(StepType.GENERAL_STOP),
    ): ExplorerStep {
        return ExplorerStep(
            setOf(blockLocation),
            FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
            stepTypes = stepTypes,
        )
    }

    @Test
    fun emptyTimetableWithForcedOpStopAndBacktracking() {
        /*
        a --(general stop && backtracking)--> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b", 1000.meters)
        val secondBlock = infra.addBlock("b", "c", 1000.meters)

        val firstBlockEnvelope =
            simulateBlock(
                infraExplorerFromBlock(
                    infra,
                    infra,
                    TestTrains.REALISTIC_FAST_TRAIN.length.meters,
                    firstBlock,
                ),
                0.0,
                Offset(0.meters),
                TestTrains.REALISTIC_FAST_TRAIN,
                Comfort.STANDARD,
                2.0,
                null,
                null,
                null,
            )!!

        val runTime = firstBlockEnvelope.totalTime
        val occupancyGraph =
            ImmutableMultimap.of(
                firstBlock,
                OccupancySegment(
                    runTime + 30 + FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
                    Double.POSITIVE_INFINITY,
                    0.meters,
                    1000.meters,
                ),
            )

        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .addStep(ExplorerStep(setOf(BlockLocation(firstBlock, Offset(0.meters)))))
                .addStep(
                    ExplorerStep(
                        setOf(BlockLocation(firstBlock, Offset(60.meters))),
                        SHORT_STOP_DURATION.inWholeSeconds.toDouble(),
                        true,
                    ),
                )
                .addStep(
                    ExplorerStep(setOf(BlockLocation(secondBlock, Offset(100.meters))), 0.0, true),
                )
                .addForcedOpStop(
                    createForcedOpStopExplorerStep(
                        BlockLocation(firstBlock, Offset(60.meters)),
                        setOf(StepType.GENERAL_STOP),
                    ),
                )
                .run()!!
        Assertions.assertTrue(res is STDCMCompleteResult)
        val resSuccess = res as STDCMCompleteResult
        occupancyTest(resSuccess, occupancyGraph)
        checkStop(
            resSuccess,
            listOf(
                TrainStop(
                    60.0,
                    FORCED_OP_STOP_DURATION.inWholeSeconds.toDouble(),
                    SHORT_SLIP_STOP,
                    setOf(StepType.INPUT_STOP, StepType.GENERAL_STOP),
                ),
            ),
        )
    }
}

// test backtracking
// test avec temps variable
