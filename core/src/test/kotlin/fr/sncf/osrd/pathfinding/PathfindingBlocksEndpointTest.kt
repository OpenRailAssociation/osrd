package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.TrackLocation
import fr.sncf.osrd.api.pathfinding.findDirectedWaypointBlocks
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.stdcm.infra_exploration.BlockLocation
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
        expectedEdgeLocations: Set<BlockLocation>,
    ) {
        val blocks = findDirectedWaypointBlocks(smallInfra, pathfindingWaypoint, direction)
        Assertions.assertThat(blocks).containsExactlyInAnyOrderElementsOf(expectedEdgeLocations)
    }

    @Test
    fun findWaypointBlocks_throws_givenIncoherentWaypoint() {
        val incoherentWaypoint = TrackLocation("TA3", Offset(100000000.meters))
        val exception =
            assertThrows(OSRDError::class.java) {
                findDirectedWaypointBlocks(smallInfra, incoherentWaypoint, Direction.INCREASING)
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
                    mutableSetOf(BlockLocation(BlockId(8U), Offset(190.meters))),
                ),
                Arguments.of(
                    TrackLocation("TA5", Offset(20.meters)),
                    Direction.DECREASING,
                    mutableSetOf(
                        BlockLocation(BlockId(19U), Offset(210.meters)),
                        BlockLocation(BlockId(18U), Offset(210.meters)),
                    ),
                ),
            )
        }
    }
}
