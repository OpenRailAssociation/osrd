package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.TrackLocation
import fr.sncf.osrd.api.pathfinding.findWaypointBlocks
import fr.sncf.osrd.pathfinding.Pathfinding.EdgeLocation
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.stream.Stream
import kotlin.test.assertEquals
import org.assertj.core.api.Assertions
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

class PathfindingBlocksEndpointTest {
    private var smallInfra: FullInfra = Helpers.smallInfra

    @ParameterizedTest
    @MethodSource("testFindWaypointBlocksArgs")
    fun testFindWaypointBlocks(
        pathfindingWaypoint: TrackLocation,
        direction: Direction,
        expectedEdgeLocations: Set<EdgeLocation<BlockId, Block>>,
    ) {
        val blocks = findWaypointBlocks(smallInfra, pathfindingWaypoint, direction)
        Assertions.assertThat(blocks).containsExactlyInAnyOrderElementsOf(expectedEdgeLocations)
    }

    @Test
    fun findWaypointBlocks_throws_givenIncoherentWaypoint() {
        val incoherentWaypoint = TrackLocation("TA3", Offset(100000000.meters))
        val exception =
            assertThrows(OSRDError::class.java) {
                findWaypointBlocks(smallInfra, incoherentWaypoint, Direction.INCREASING)
            }
        assertEquals(ErrorType.InvalidWaypointLocation, exception.osrdErrorType)
    }

    companion object {
        @JvmStatic
        fun testFindWaypointBlocksArgs(): Stream<Arguments> {
            return Stream.of(
                Arguments.of(
                    TrackLocation("TA3", Offset(10.meters)),
                    Direction.INCREASING,
                    mutableSetOf(EdgeLocation(BlockId(8U), Offset<Block>(190.meters))),
                ),
                Arguments.of(
                    TrackLocation("TA5", Offset(20.meters)),
                    Direction.DECREASING,
                    mutableSetOf(
                        EdgeLocation(BlockId(19U), Offset<Block>(210.meters)),
                        EdgeLocation(BlockId(18U), Offset(210.meters)),
                    ),
                ),
            )
        }
    }
}
