package fr.sncf.osrd.api.pathfinding;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.AssertionsForClassTypes.assertThatThrownBy;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import java.util.Set;
import java.util.stream.Stream;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class PathfindingBlocksEndpointTest {

    private FullInfra smallInfra;

    @BeforeAll
    public void setUp() {
        smallInfra = Helpers.getSmallInfra();
    }

    @ParameterizedTest
    @MethodSource("testFindWaypointBlocksArgs")
    public void testFindWaypointBlocks(PathfindingWaypoint pathfindingWaypoint,
                                       Set<Pathfinding.EdgeLocation<Integer>> expectedEdgeLocations) {
        var blocks = PathfindingBlocksEndpoint.findWaypointBlocks(smallInfra, pathfindingWaypoint);
        assertThat(blocks).containsExactlyInAnyOrderElementsOf(expectedEdgeLocations);
    }

    @Test
    public void findWaypointBlocks_throws_givenIncoherentWaypoint() {
        var incoherentWaypoint = new PathfindingWaypoint("TA3", 100000000, EdgeDirection.START_TO_STOP);
        assertThatThrownBy(() -> PathfindingBlocksEndpoint.findWaypointBlocks(smallInfra, incoherentWaypoint))
                .isExactlyInstanceOf(RuntimeException.class)
                .hasMessage("The waypoint is not located on the track section 3");
    }

    static Stream<Arguments> testFindWaypointBlocksArgs() {
        return Stream.of(
                Arguments.of(
                        new PathfindingWaypoint("TA3", 10, EdgeDirection.START_TO_STOP),
                        Set.of(new Pathfinding.EdgeLocation<>(3, 190000.0))),
                Arguments.of(
                        new PathfindingWaypoint("TA5", 20, EdgeDirection.STOP_TO_START),
                        Set.of(new Pathfinding.EdgeLocation<>(19, 210000.0),
                                new Pathfinding.EdgeLocation<>(20, 210000.0)))
        );
    }
}
