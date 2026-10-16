package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.RJSTrackLocation
import fr.sncf.osrd.api.parseRJSTrackLocation
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockLocation
import fr.sncf.osrd.sim_infra.api.findDirTrackLocationBlocks
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
        pathfindingWaypoint: RJSTrackLocation,
        direction: Direction,
        expectedEdgeLocations: Set<BlockLocation>,
    ) {
        val trackLocation = parseRJSTrackLocation(smallInfra.rawInfra, pathfindingWaypoint)
        val blocks =
            smallInfra.blockInfra.findDirTrackLocationBlocks(
                smallInfra.rawInfra,
                trackLocation,
                direction,
            )
        Assertions.assertThat(blocks).containsExactlyInAnyOrderElementsOf(expectedEdgeLocations)
    }

    @Test
    fun findWaypointBlocks_throws_givenIncoherentWaypoint() {
        val incoherentWaypoint = RJSTrackLocation("TA3", Offset(100000000.meters))
        val incoherentTrackLocation = parseRJSTrackLocation(smallInfra.rawInfra, incoherentWaypoint)
        val exception =
            assertThrows(OSRDError::class.java) {
                smallInfra.blockInfra.findDirTrackLocationBlocks(
                    smallInfra.rawInfra,
                    incoherentTrackLocation,
                    Direction.INCREASING,
                )
            }
        assertEquals(ErrorType.InvalidWaypointLocation, exception.osrdErrorType)
    }

    companion object {
        @JvmStatic
        fun testFindWaypointBlocksArgs(): Stream<Arguments> {
            return Stream.of(
                Arguments.of(
                    RJSTrackLocation("TA3", Offset(10.meters)),
                    Direction.INCREASING,
                    mutableSetOf(BlockLocation(BlockId(8U), Offset(190.meters))),
                ),
                Arguments.of(
                    RJSTrackLocation("TA5", Offset(20.meters)),
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
