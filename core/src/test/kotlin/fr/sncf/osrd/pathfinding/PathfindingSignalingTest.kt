package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.api_v2.DirectionalTrackRange
import fr.sncf.osrd.api.api_v2.TrackLocation
import fr.sncf.osrd.api.api_v2.pathfinding.IncompatibleConstraintsPathResponse
import fr.sncf.osrd.api.api_v2.pathfinding.NoPathFoundException
import fr.sncf.osrd.api.api_v2.pathfinding.PathfindingBlockRequest
import fr.sncf.osrd.api.api_v2.pathfinding.PathfindingBlockSuccess
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection.START_TO_STOP
import fr.sncf.osrd.signaling.tvm300.TVM300
import fr.sncf.osrd.signaling.tvm430.TVM430
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PathfindingSignalingTest {
    private var infra: DummyInfra = DummyInfra()

    private fun setSigSystemIds(blocks: List<String>, signaling: String) {
        val id =
            infra.fullInfra().signalingSimulator.sigModuleManager.findSignalingSystem(signaling)
        infra.blockPool.forEach { if (blocks.contains(it.name)) it.signalingSystemId = id!! }
    }

    private fun getPathfindingBlockRequest(
        rs: RollingStock,
        pathItems: List<Collection<TrackLocation>>
    ): PathfindingBlockRequest {
        return PathfindingBlockRequest(
            rs.loadingGaugeType,
            rs.isThermal,
            rs.modeNames.filterNot { it == "thermal" }.toList(),
            rs.supportedSignalingSystems.toList(),
            rs.maxSpeed,
            rs.length,
            null,
            "unused_name",
            "unused_version",
            pathItems
        )
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
                fr.sncf.osrd.api.api_v2.pathfinding.runPathfinding(
                    infra.fullInfra(),
                    getPathfindingBlockRequest(
                        TestTrains.TRAIN_WITHOUT_TVM,
                        listOf(waypointsStart, waypointsEnd)
                    )
                )
            }
            .isExactlyInstanceOf(NoPathFoundException::class.java)
            .satisfies({ exception: Throwable ->
                val resp =
                    (exception as NoPathFoundException).response
                        as IncompatibleConstraintsPathResponse
                assert(resp.relaxedConstraintsPath.length.distance == 400.meters)
                assert(
                    resp.incompatibleConstraints.incompatibleSignalingSystemRanges.first().value ==
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
            fr.sncf.osrd.api.api_v2.pathfinding.runPathfinding(
                infra.fullInfra(),
                getPathfindingBlockRequest(
                    TestTrains.TRAIN_WITHOUT_TVM,
                    listOf(waypointsStart, waypointsEnd)
                )
            )
        assertThat(pathfindingResp).isExactlyInstanceOf(PathfindingBlockSuccess::class.java)
        assertThat((pathfindingResp as PathfindingBlockSuccess).trackSectionRanges)
            .isEqualTo(
                arrayListOf(
                    DirectionalTrackRange("a->b", Offset.zero(), Offset(100.meters), START_TO_STOP),
                    DirectionalTrackRange("b->N", Offset.zero(), Offset(100.meters), START_TO_STOP),
                    DirectionalTrackRange("N->d", Offset.zero(), Offset(100.meters), START_TO_STOP),
                    DirectionalTrackRange("d->e", Offset.zero(), Offset(100.meters), START_TO_STOP)
                )
            )
    }

    @Test
    fun shouldFindSouthPathOnBalBlocksForBalTrain() {
        setSigSystemIds(listOf("b->N", "N->d"), TVM430.id)
        val waypointsStart = listOf(TrackLocation("a->b", Offset.zero()))
        val waypointsEnd = listOf(TrackLocation("d->e", Offset(100.meters)))

        val pathfindingResp =
            fr.sncf.osrd.api.api_v2.pathfinding.runPathfinding(
                infra.fullInfra(),
                getPathfindingBlockRequest(
                    TestTrains.TRAIN_WITHOUT_TVM,
                    listOf(waypointsStart, waypointsEnd)
                )
            )
        assertThat(pathfindingResp).isExactlyInstanceOf(PathfindingBlockSuccess::class.java)
        assertThat((pathfindingResp as PathfindingBlockSuccess).trackSectionRanges)
            .isEqualTo(
                arrayListOf(
                    DirectionalTrackRange("a->b", Offset.zero(), Offset(100.meters), START_TO_STOP),
                    DirectionalTrackRange("b->S", Offset.zero(), Offset(100.meters), START_TO_STOP),
                    DirectionalTrackRange("S->d", Offset.zero(), Offset(100.meters), START_TO_STOP),
                    DirectionalTrackRange("d->e", Offset.zero(), Offset(100.meters), START_TO_STOP)
                )
            )
    }
}
