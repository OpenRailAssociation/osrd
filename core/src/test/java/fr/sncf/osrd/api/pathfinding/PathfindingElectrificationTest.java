package fr.sncf.osrd.api.pathfinding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.google.common.collect.Range;
import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.ApiTest;
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.api.tracks.undirected.DeadSection;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackEdge;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackSection;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.train.TestTrains;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.List;
import java.util.stream.Stream;


public class PathfindingElectrificationTest extends ApiTest {
    private static void fillInfraWithCatenaries(SignalingInfra infra, String voltage) {
        for (var track : infra.getTrackGraph().edges()) {
            if (track instanceof TrackSection)
                track.getVoltages().put(Range.closed(0., track.getLength()), voltage);
        }
    }

    private static TrackEdge getMiddleTrackEdge(Pathfinding.Result<SignalingRoute> normalPath) {
        var middleRoute = normalPath.ranges().get(normalPath.ranges().size() / 2);
        var tracks = middleRoute.edge().getInfraRoute().getTrackRanges();
        return tracks.get(tracks.size() / 2).track.getEdge();
    }

    private static void removeMiddleCatenary(Pathfinding.Result<SignalingRoute> normalPath) {
        var middleTrack = getMiddleTrackEdge(normalPath);
        middleTrack.getVoltages().put(Range.closed(middleTrack.getLength() * 0.1, middleTrack.getLength() * 0.9), "");
    }

    private static void addMiddleDeadSection(Pathfinding.Result<SignalingRoute> normalPath, Direction direction) {
        var middleTrack = getMiddleTrackEdge(normalPath);
        var range = Range.closed(0., middleTrack.getLength() * 0.9);
        middleTrack.getDeadSections(direction).put(range, new DeadSection(false));
    }

    @Test
    public void incompatibleCatenariesTest() throws Exception {
        var infra = Helpers.infraFromRJS(Helpers.getExampleInfra("small_infra/infra.json"));

        var waypointStart = new PathfindingWaypoint(
                "TA1",
                1550,
                EdgeDirection.START_TO_STOP
        );
        var waypointEnd = new PathfindingWaypoint(
                "TH0",
                1500,
                EdgeDirection.START_TO_STOP
        );
        var waypoints = new PathfindingWaypoint[2][1];
        waypoints[0][0] = waypointStart;
        waypoints[1][0] = waypointEnd;

        // Run a pathfinding with a non-electric train
        var normalPath = PathfindingRoutesEndpoint.runPathfinding(
                infra, waypoints, List.of(TestTrains.REALISTIC_FAST_TRAIN)
        );
        assertNotNull(normalPath);

        // Put catenary everywhere
        assert TestTrains.FAST_ELECTRIC_TRAIN.getModeNames().contains("25000");
        fillInfraWithCatenaries(infra, "25000");

        // Removes catenary in the middle of the path
        removeMiddleCatenary(normalPath);

        // Run another pathfinding with an electric train
        var electricPath = PathfindingRoutesEndpoint.runPathfinding(
                infra,
                waypoints,
                List.of(TestTrains.FAST_ELECTRIC_TRAIN)
        );
        assertNotNull(electricPath);

        // We check that the path is different, we need to avoid the non-electrified track
        var normalRoutes = normalPath.ranges().stream()
                .map(range -> range.edge().getInfraRoute().getID())
                .toList();
        var electrifiedRoutes = electricPath.ranges().stream()
                .map(range -> range.edge().getInfraRoute().getID())
                .toList();
        assertNotEquals(normalRoutes, electrifiedRoutes);

        // Remove all electrification
        for (var track : infra.getTrackGraph().edges()) {
            if (track instanceof TrackSection)
                track.getVoltages().put(Range.closed(0., track.getLength()), "");
        }

        var exception = assertThrows(
                OSRDError.class,
                () -> PathfindingRoutesEndpoint.runPathfinding(
                        infra,
                        waypoints,
                        List.of(TestTrains.FAST_ELECTRIC_TRAIN)));
        assertEquals(exception.osrdErrorType, ErrorType.PathfindingElectrificationError);
    }

    static Stream<Arguments> testDeadSectionArgs() {
        return Stream.of(
                // With catenary, with dead section, dead section direction
                Arguments.of(true, true, Direction.FORWARD),
                Arguments.of(true, true, Direction.BACKWARD),
                Arguments.of(true, false, null),
                Arguments.of(false, true, Direction.FORWARD),
                Arguments.of(false, true, Direction.BACKWARD),
                Arguments.of(false, false, null)
        );
    }

    @ParameterizedTest
    @MethodSource("testDeadSectionArgs")
    public void testDeadSectionAndCatenaryPathfinding(boolean withCatenary, boolean withDeadSection,
                                                      Direction deadSectionDirection)
            throws IOException, URISyntaxException {
        var infra = Helpers.infraFromRJS(Helpers.getExampleInfra("small_infra/infra.json"));

        var waypointStart = new PathfindingWaypoint(
                "TD1",
                0,
                EdgeDirection.START_TO_STOP
        );
        var waypointEnd = new PathfindingWaypoint(
                "TG2",
                103,
                EdgeDirection.START_TO_STOP
        );
        var waypoints = new PathfindingWaypoint[2][1];
        waypoints[0][0] = waypointStart;
        waypoints[1][0] = waypointEnd;

        // Run a pathfinding with a non-electric train
        var normalPath = PathfindingRoutesEndpoint.runPathfinding(
                infra, waypoints, List.of(TestTrains.REALISTIC_FAST_TRAIN)
        );
        assertNotNull(normalPath);

        // Put catenary everywhere
        assert TestTrains.FAST_ELECTRIC_TRAIN.getModeNames().contains("25000");
        fillInfraWithCatenaries(infra, "25000");

        if (!withCatenary) {
            // Remove catenary in the middle of the path
            removeMiddleCatenary(normalPath);
        }

        if (withDeadSection) {
            // Add a dead section in the middle of the path
            addMiddleDeadSection(normalPath, deadSectionDirection);
        }

        if (withCatenary || (withDeadSection && deadSectionDirection == Direction.FORWARD)) {
            // Run another pathfinding with an electric train
            var electricPath = PathfindingRoutesEndpoint.runPathfinding(
                    infra,
                    waypoints,
                    List.of(TestTrains.FAST_ELECTRIC_TRAIN)
            );
            assertNotNull(electricPath);
        } else {
            var exception = assertThrows(
                    OSRDError.class,
                    () -> PathfindingRoutesEndpoint.runPathfinding(
                            infra,
                            waypoints,
                            List.of(TestTrains.FAST_ELECTRIC_TRAIN)));
            assertEquals(exception.osrdErrorType, ErrorType.PathfindingElectrificationError);
        }
    }
}
