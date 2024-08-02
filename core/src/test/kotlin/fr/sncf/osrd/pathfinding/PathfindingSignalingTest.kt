package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.pathfinding.runPathfinding
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.findSignalingSystemOrThrow
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import org.assertj.core.api.Assertions as assertjAssertions
import org.assertj.core.api.AssertionsForClassTypes
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PathfindingSignalingTest {
    private var infra: DummyInfra = DummyInfra()

    private fun setSigSystemIds(list: List<BlockId>, signalingSystemName: String) {
        val id =
            infra
                .fullInfra()
                .signalingSimulator
                .sigModuleManager
                .findSignalingSystemOrThrow(signalingSystemName)
        list.forEach { infra.blockPool[it.index.toInt()].signalingSystemId = id }
    }

    @BeforeEach
    fun setUp() {
        /*       c1
                ^  \
               /    v
        a --> b     d --> e
               \    ^
                v  /
                 c2
         */
        infra = DummyInfra()
        infra.addBlock("a", "b")
        infra.addBlock("b", "c1")
        infra.addBlock("b", "c2")
        infra.addBlock("c1", "d")
        infra.addBlock("c2", "d")
        infra.addBlock("d", "e")
    }

    @Test
    fun balTrainOnTVMBlockShouldThrow() {
        setSigSystemIds(listOf(1U, 2U, 3U, 4U).map { BlockId(it) }, "TVM300")
        val waypointStart = PathfindingWaypoint("a->b", 0.0, EdgeDirection.START_TO_STOP)
        val waypointEnd = PathfindingWaypoint("d->e", 100.0, EdgeDirection.START_TO_STOP)
        val waypoints = Array(2) { Array(1) { waypointStart } }
        waypoints[1][0] = waypointEnd

        // Run a pathfinding with a non TVM train, expecting not to find any path
        AssertionsForClassTypes.assertThatThrownBy {
                runPathfinding(
                    infra.fullInfra(),
                    waypoints,
                    listOf(TestTrains.TRAIN_WITHOUT_TVM),
                    null
                )
            }
            .isExactlyInstanceOf(OSRDError::class.java)
            .satisfies({ exception: Throwable? ->
                assertjAssertions
                    .assertThat((exception as OSRDError?)!!.osrdErrorType)
                    .isEqualTo(ErrorType.PathfindingSignalisationSystemError)
            })
    }

    @Test
    fun shouldFindTopPathOnBalBlocksForBalTrain() {
        setSigSystemIds(listOf(2U, 4U).map { BlockId(it) }, "TVM300")
        val waypointStart = PathfindingWaypoint("a->b", 0.0, EdgeDirection.START_TO_STOP)
        val waypointEnd = PathfindingWaypoint("d->e", 100.0, EdgeDirection.START_TO_STOP)
        val waypoints = Array(2) { Array(1) { waypointStart } }
        waypoints[1][0] = waypointEnd

        val pathfindingResult =
            runPathfinding(infra.fullInfra(), waypoints, listOf(TestTrains.TRAIN_WITHOUT_TVM), null)

        AssertionsForClassTypes.assertThat(pathfindingResult.ranges)
            .isEqualTo(
                arrayListOf(
                    Pathfinding.EdgeRange(BlockId(0U), Offset<Block>(0.meters), Offset(100.meters)),
                    Pathfinding.EdgeRange(BlockId(1U), Offset(0.meters), Offset(100.meters)),
                    Pathfinding.EdgeRange(BlockId(3U), Offset(0.meters), Offset(100.meters)),
                    Pathfinding.EdgeRange(BlockId(5U), Offset(0.meters), Offset(100.meters))
                )
            )
    }

    @Test
    fun shouldFindBottomPathOnBalBlocksForBalTrain() {
        setSigSystemIds(listOf(1U, 3U).map { BlockId(it) }, "TVM430")
        val waypointStart = PathfindingWaypoint("a->b", 0.0, EdgeDirection.START_TO_STOP)
        val waypointEnd = PathfindingWaypoint("d->e", 100.0, EdgeDirection.START_TO_STOP)
        val waypoints = Array(2) { Array(1) { waypointStart } }
        waypoints[1][0] = waypointEnd

        val pathfindingResult =
            runPathfinding(infra.fullInfra(), waypoints, listOf(TestTrains.TRAIN_WITHOUT_TVM), null)

        AssertionsForClassTypes.assertThat(pathfindingResult.ranges)
            .isEqualTo(
                arrayListOf(
                    Pathfinding.EdgeRange(BlockId(0U), Offset<Block>(0.meters), Offset(100.meters)),
                    Pathfinding.EdgeRange(BlockId(2U), Offset(0.meters), Offset(100.meters)),
                    Pathfinding.EdgeRange(BlockId(4U), Offset(0.meters), Offset(100.meters)),
                    Pathfinding.EdgeRange(BlockId(5U), Offset(0.meters), Offset(100.meters))
                )
            )
    }
}
