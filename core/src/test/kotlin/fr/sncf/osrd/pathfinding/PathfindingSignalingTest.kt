package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.TrackLocation
import fr.sncf.osrd.api.pathfinding.IncompatibleConstraintsPathResponse
import fr.sncf.osrd.api.pathfinding.NoPathFoundException
import fr.sncf.osrd.api.pathfinding.runPathfinding
import fr.sncf.osrd.path.interfaces.JsonTrainPath.*
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection.START_TO_STOP
import fr.sncf.osrd.signaling.tvm300.TVM300
import fr.sncf.osrd.signaling.tvm430.TVM430
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PathfindingSignalingTest {
    private var infra: DummyInfra = DummyInfra()

    private fun setSigSystemIds(blocks: List<String>, signaling: String) {
        val id =
            infra.fullInfra().signalingSimulator.sigModuleManager.findSignalingSystem(signaling)
        infra.blockPool.forEach { if (blocks.contains(it.name)) it.signalingSystemId = id!! }
    }

    @BeforeEach
    fun setUp() {
        /*        N
                ^  \
               /    v
        a --> b     d --> e
               \    ^
                v  /
                 S
         */
        infra = DummyInfra()
        infra.addBlock("a", "b")
        infra.addBlock("b", "N")
        infra.addBlock("b", "S")
        infra.addBlock("N", "d")
        infra.addBlock("S", "d")
        infra.addBlock("d", "e")
    }

    @Test
    fun balTrainOnTVMBlockShouldThrow() {
        setSigSystemIds(listOf("b->N", "b->S", "N->d", "S->d"), TVM300.id)
        val waypointsStart = listOf(TrackLocation("a->b", Offset.zero()))
        val waypointsEnd = listOf(TrackLocation("d->e", Offset(100.meters)))

        // Run a pathfinding with a non TVM train, expecting not to find any path
        assertThatThrownBy {
                runPathfinding(
                    infra.fullInfra(),
                    getPathfindingBlockRequest(
                        TestTrains.TRAIN_WITHOUT_TVM,
                        listOf(waypointsStart, waypointsEnd),
                    ),
                )
            }
            .isExactlyInstanceOf(NoPathFoundException::class.java)
            .satisfies({ exception: Throwable ->
                val resp =
                    (exception as NoPathFoundException).response
                        as IncompatibleConstraintsPathResponse
                assert(resp.relaxedConstraintsPath.length.distance == 400.meters)
                assert(
                    resp.incompatibleConstraints.incompatibleSignalingSystemRanges.single().value ==
                        TVM300.id
                )
            })
    }

    @Test
    fun shouldFindNorthPathOnBalBlocksForBalTrain() {
        setSigSystemIds(listOf("b->S", "S->d"), TVM300.id)
        val waypointsStart = listOf(TrackLocation("a->b", Offset(0.meters)))
        val waypointsEnd = listOf(TrackLocation("d->e", Offset(100.meters)))

        val pathfindingResp =
            runPathfinding(
                infra.fullInfra(),
                getPathfindingBlockRequest(
                    TestTrains.TRAIN_WITHOUT_TVM,
                    listOf(waypointsStart, waypointsEnd),
                ),
            )
        checkPathfindingSuccess(
            pathfindingResp,
            400.meters,
            expectedTrackSectionRanges =
                arrayListOf(
                    TrackSectionRange("a->b", Offset.zero(), Offset(100.meters), START_TO_STOP),
                    TrackSectionRange("b->N", Offset.zero(), Offset(100.meters), START_TO_STOP),
                    TrackSectionRange("N->d", Offset.zero(), Offset(100.meters), START_TO_STOP),
                    TrackSectionRange("d->e", Offset.zero(), Offset(100.meters), START_TO_STOP),
                ),
        )
    }

    @Test
    fun shouldFindSouthPathOnBalBlocksForBalTrain() {
        setSigSystemIds(listOf("b->N", "N->d"), TVM430.id)
        val waypointsStart = listOf(TrackLocation("a->b", Offset.zero()))
        val waypointsEnd = listOf(TrackLocation("d->e", Offset(100.meters)))

        val pathfindingResp =
            runPathfinding(
                infra.fullInfra(),
                getPathfindingBlockRequest(
                    TestTrains.TRAIN_WITHOUT_TVM,
                    listOf(waypointsStart, waypointsEnd),
                ),
            )
        checkPathfindingSuccess(
            pathfindingResp,
            400.meters,
            expectedTrackSectionRanges =
                arrayListOf(
                    TrackSectionRange("a->b", Offset.zero(), Offset(100.meters), START_TO_STOP),
                    TrackSectionRange("b->S", Offset.zero(), Offset(100.meters), START_TO_STOP),
                    TrackSectionRange("S->d", Offset.zero(), Offset(100.meters), START_TO_STOP),
                    TrackSectionRange("d->e", Offset.zero(), Offset(100.meters), START_TO_STOP),
                ),
        )
    }

    @ParameterizedTest
    @CsvSource(
        "ETCS_LEVEL2, TVM430, N",
        "TVM430, TVM300, N",
        "TVM300, BAL, N",
        "BAL, BAPR, N",
        "TVM430, ETCS_LEVEL2, S",
        "TVM300, TVM430, S",
        "BAL, TVM300, S",
        "BAPR, BAL, S",
    )
    fun shouldPriorEtcsThenTvm430ThenTvm300ThenBalThenBaprForPathfinding(
        northSigSystem: String,
        southSigSystem: String,
        intermediateWaypoint: String,
    ) {
        // Other blocks are BAL
        setSigSystemIds(listOf("b->N", "N->d"), northSigSystem)
        setSigSystemIds(listOf("b->S", "S->d"), southSigSystem)

        val waypointsStart = listOf(TrackLocation("a->b", Offset.zero()))
        val waypointsInter =
            listOf(TrackLocation("S->d", Offset.zero()), TrackLocation("N->d", Offset.zero()))
        val waypointsEnd = listOf(TrackLocation("d->e", Offset(100.meters)))

        val pathfindingSouthResp =
            runPathfinding(
                infra.fullInfra(),
                getPathfindingBlockRequest(
                    TestTrains.REALISTIC_ETCS_FAST_TRAIN,
                    listOf(waypointsStart, waypointsInter, waypointsEnd),
                ),
            )
        checkPathfindingSuccess(
            pathfindingSouthResp,
            400.meters,
            expectedIntermediatePathItemPosition = listOf(Offset(200.meters)),
            expectedTrackSectionRanges =
                arrayListOf(
                    TrackSectionRange("a->b", Offset.zero(), Offset(100.meters), START_TO_STOP),
                    TrackSectionRange(
                        "b->$intermediateWaypoint",
                        Offset.zero(),
                        Offset(100.meters),
                        START_TO_STOP,
                    ),
                    TrackSectionRange(
                        "$intermediateWaypoint->d",
                        Offset.zero(),
                        Offset(100.meters),
                        START_TO_STOP,
                    ),
                    TrackSectionRange("d->e", Offset.zero(), Offset(100.meters), START_TO_STOP),
                ),
        )
    }
}
