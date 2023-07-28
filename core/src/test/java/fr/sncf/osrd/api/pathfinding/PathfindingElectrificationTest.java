package fr.sncf.osrd.api.pathfinding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import fr.sncf.osrd.api.ApiTest;
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.sim_infra.impl.NeutralSection;
import fr.sncf.osrd.train.TestTrains;
import fr.sncf.osrd.utils.DummyInfra;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;


public class PathfindingElectrificationTest extends ApiTest {
    @Test
    public void incompatibleCatenariesTest() {
        /*       c1
                ^  \
               /    v
        a --> b     d --> e
               \    ^
                v  /
                 c2
         */
        var infra = DummyInfra.make();
        infra.addBlock("a", "b");
        infra.addBlock("b", "c1");
        infra.addBlock("b", "c2");
        infra.addBlock("c1", "d");
        infra.addBlock("c2", "d");
        infra.addBlock("d", "e");

        var waypointStart = new PathfindingWaypoint(
                "a->b",
                0,
                EdgeDirection.START_TO_STOP
        );
        var waypointEnd = new PathfindingWaypoint(
                "d->e",
                100,
                EdgeDirection.START_TO_STOP
        );
        var waypoints = new PathfindingWaypoint[2][1];
        waypoints[0][0] = waypointStart;
        waypoints[1][0] = waypointEnd;

        // Run a pathfinding with a non-electric train
        var normalPath = PathfindingBlocksEndpoint.runPathfinding(
                infra.fullInfra(), waypoints, List.of(TestTrains.REALISTIC_FAST_TRAIN)
        );
        assertNotNull(normalPath);

        // Put catenary everywhere
        assert TestTrains.FAST_ELECTRIC_TRAIN.getModeNames().contains("25000");
        for (var block : infra.getBlockPool())
            block.setVoltage("25000");

        // Removes catenary in the section used by the normal train
        for (var range : normalPath.ranges()) {
            if (Set.of("b->c1", "b->c2").contains(infra.getRouteName(range.edge()))) {
                infra.getBlockPool().get(range.edge()).setVoltage("");
            }
        }

        // Run another pathfinding with an electric train
        var electricPath = PathfindingBlocksEndpoint.runPathfinding(
                infra.fullInfra(),
                waypoints,
                List.of(TestTrains.FAST_ELECTRIC_TRAIN)
        );
        assertNotNull(electricPath);

        // We check that the path is different, we need to avoid the non-electrified track
        var normalRoutes = normalPath.ranges().stream()
                .map(range -> infra.getRouteName(range.edge()))
                .toList();
        var electrifiedRoutes = electricPath.ranges().stream()
                .map(range -> infra.getRouteName(range.edge()))
                .toList();
        assertNotEquals(normalRoutes, electrifiedRoutes);

        // Remove all electrification
        for (var block : infra.getBlockPool())
            block.setVoltage("");

        var exception = assertThrows(
                OSRDError.class,
                () -> PathfindingBlocksEndpoint.runPathfinding(
                        infra.fullInfra(),
                        waypoints,
                        List.of(TestTrains.FAST_ELECTRIC_TRAIN)));
        assertEquals(exception.osrdErrorType, ErrorType.PathfindingElectrificationError);
    }

    static Stream<Arguments> testNeutralSectionArgs() {
        return Stream.of(
                // With catenary, with neutral section, neutral section direction
                Arguments.of(true, true, Direction.FORWARD),
                Arguments.of(true, true, Direction.BACKWARD),
                Arguments.of(true, false, null),
                Arguments.of(false, true, Direction.FORWARD),
                Arguments.of(false, true, Direction.BACKWARD),
                Arguments.of(false, false, null)
        );
    }

    @ParameterizedTest
    @MethodSource("testNeutralSectionArgs")
    public void testNeutralSectionAndCatenaryPathfinding(boolean withCatenary, boolean withNeutralSection,
                                                      Direction neutralSectionDirection) {
        var infra = DummyInfra.make();
        infra.addBlock("a", "b");
        final var secondBlock = infra.addBlock("b", "c");
        infra.addBlock("c", "d");

        var waypointStart = new PathfindingWaypoint(
                "a->b",
                0,
                EdgeDirection.START_TO_STOP
        );
        var waypointEnd = new PathfindingWaypoint(
                "c->d",
                100,
                EdgeDirection.START_TO_STOP
        );
        var waypoints = new PathfindingWaypoint[2][1];
        waypoints[0][0] = waypointStart;
        waypoints[1][0] = waypointEnd;

        // Run a pathfinding with a non-electric train
        var normalPath = PathfindingBlocksEndpoint.runPathfinding(
                infra.fullInfra(), waypoints, List.of(TestTrains.REALISTIC_FAST_TRAIN)
        );
        assertNotNull(normalPath);

        // Put catenary everywhere
        assert TestTrains.FAST_ELECTRIC_TRAIN.getModeNames().contains("25000");
        for (var block : infra.getBlockPool())
            block.setVoltage("25000");

        if (!withCatenary) {
            // Remove catenary in the middle of the path
            infra.getBlockPool().get(secondBlock).setVoltage("");
        }

        if (withNeutralSection) {
            // Add a neutral section in the middle of the path
            if (neutralSectionDirection == Direction.FORWARD)
                infra.getBlockPool().get(secondBlock).setNeutralSectionForward(new NeutralSection(false, false));
            else
                infra.getBlockPool().get(secondBlock).setNeutralSectionBackward(new NeutralSection(false, false));
        }

        if (withCatenary || (withNeutralSection && neutralSectionDirection == Direction.FORWARD)) {
            // Run another pathfinding with an electric train
            var electricPath = PathfindingBlocksEndpoint.runPathfinding(
                    infra.fullInfra(),
                    waypoints,
                    List.of(TestTrains.FAST_ELECTRIC_TRAIN)
            );
            assertNotNull(electricPath);
        } else {
            var exception = assertThrows(
                    OSRDError.class,
                    () -> PathfindingBlocksEndpoint.runPathfinding(
                            infra.fullInfra(),
                            waypoints,
                            List.of(TestTrains.FAST_ELECTRIC_TRAIN)));
            assertEquals(exception.osrdErrorType, ErrorType.PathfindingElectrificationError);
        }
    }
}
