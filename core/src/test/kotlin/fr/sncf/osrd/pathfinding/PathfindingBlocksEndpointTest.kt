package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.pathfinding.findWaypointBlocks
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint
import fr.sncf.osrd.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.stream.Stream
import kotlin.test.assertEquals
import org.assertj.core.api.Assertions
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PathfindingBlocksEndpointTest {
    private var smallInfra: FullInfra? = null

    @BeforeAll
    fun setUp() {
        smallInfra = Helpers.smallInfra
    }

    @ParameterizedTest
    @MethodSource("testFindWaypointBlocksArgs")
    fun testFindWaypointBlocks(
        pathfindingWaypoint: PathfindingWaypoint,
        expectedEdgeLocations: Set<PathfindingEdgeLocationId<Block>>
    ) {
        val blocks = findWaypointBlocks(smallInfra!!, pathfindingWaypoint)
        Assertions.assertThat(blocks).containsExactlyInAnyOrderElementsOf(expectedEdgeLocations)
    }

    @Test
    fun findWaypointBlocks_throws_givenIncoherentWaypoint() {
        val incoherentWaypoint =
            PathfindingWaypoint("TA3", 100000000.0, EdgeDirection.START_TO_STOP)
        val exception =
            assertThrows(OSRDError::class.java) {
                findWaypointBlocks(smallInfra!!, incoherentWaypoint)
            }
        assertEquals(ErrorType.InvalidWaypointLocation, exception.osrdErrorType)
    }

    companion object {
        @JvmStatic
        fun testFindWaypointBlocksArgs(): Stream<Arguments> {
            return Stream.of(
                Arguments.of(
                    PathfindingWaypoint("TA3", 10.0, EdgeDirection.START_TO_STOP),
                    mutableSetOf(EdgeLocation(BlockId(8U), Offset<Block>(190.meters)))
                ),
                Arguments.of(
                    PathfindingWaypoint("TA5", 20.0, EdgeDirection.STOP_TO_START),
                    mutableSetOf(
                        EdgeLocation(BlockId(19U), Offset<Block>(210.meters)),
                        EdgeLocation(BlockId(18U), Offset<Block>(210.meters))
                    )
                )
            )
        }
    }
}
