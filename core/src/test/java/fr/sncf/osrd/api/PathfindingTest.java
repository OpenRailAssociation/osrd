package fr.sncf.osrd.api;

import static fr.sncf.osrd.Helpers.getResourcePath;
import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.PathfindingEndpoint.PathfindingWaypoint;
import fr.sncf.osrd.infra.implementation.reservation.ReservationInfraBuilder;
import fr.sncf.osrd.railjson.schema.RJSSimulation;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.utils.moshi.MoshiUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.takes.rq.RqFake;
import org.takes.rs.RsPrint;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.stream.Stream;


public class PathfindingTest extends ApiTest {
    private static PathfindingWaypoint[] makeBidirectionalEndPoint(PathfindingWaypoint point) {
        var waypointInverted = new PathfindingWaypoint(point.trackSection, point.offset, point.direction.opposite());
        return new PathfindingWaypoint[]{point, waypointInverted};
    }

    private static void expectWaypointInPathResult(
            PathfindingResult result,
            PathfindingWaypoint waypoint
    ) {
        for (var route : result.routePaths) {
            for (var track : route.trackSections) {
                if (!track.trackSection.id.id.equals(waypoint.trackSection))
                    continue;
                final var begin = Math.min(track.begin, track.end);
                final var end = Math.max(track.begin, track.end);
                if (begin <= waypoint.offset && end >= waypoint.offset)
                    return;
            }
        }
        fail("Expected path result to contain a location but not found");
    }

    @Test
    public void simpleRoutes() throws Exception {
        var waypointStart = new PathfindingWaypoint(
                "ne.micro.foo_b",
                100,
                EdgeDirection.START_TO_STOP
        );
        var waypointEnd = new PathfindingWaypoint(
                "ne.micro.bar_a",
                100,
                EdgeDirection.START_TO_STOP
        );
        var waypointsStart = makeBidirectionalEndPoint(waypointStart);
        var waypointsEnd = makeBidirectionalEndPoint(waypointEnd);
        var waypoints = new PathfindingWaypoint[2][];
        waypoints[0] = waypointsStart;
        waypoints[1] = waypointsEnd;
        var requestBody = PathfindingEndpoint.adapterRequest.toJson(
                new PathfindingEndpoint.PathfindingRequest(waypoints, "tiny_infra/infra.json", "1"));

        var result = new RsPrint(
                new PathfindingRoutesEndpoint(infraHandlerMock).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody))
        ).printBody();

        var response = PathfindingRoutesEndpoint.adapterResult.fromJson(result);
        assert response != null;

        assertEquals(2, response.routePaths.size());
        assertEquals("rt.buffer_stop_b->tde.foo_b-switch_foo", response.routePaths.get(0).route.id.id);
        assertEquals("rt.tde.foo_b-switch_foo->buffer_stop_c", response.routePaths.get(1).route.id.id);

        assertEquals(2, response.pathWaypoints.size());
        assertEquals("op.station_foo", response.pathWaypoints.get(0).id);
        assertEquals("op.station_bar", response.pathWaypoints.get(1).id);
    }

    @Test
    public void testMiddleStop() throws Exception {
        var waypointStart = new PathfindingWaypoint(
                "ne.micro.foo_b",
                100,
                EdgeDirection.START_TO_STOP
        );
        var waypointMid = new PathfindingWaypoint(
                "ne.micro.foo_to_bar",
                5000,
                EdgeDirection.START_TO_STOP
        );
        var waypointEnd = new PathfindingWaypoint(
                "ne.micro.bar_a",
                100,
                EdgeDirection.START_TO_STOP
        );
        var waypoints = new PathfindingWaypoint[3][];
        waypoints[0] = makeBidirectionalEndPoint(waypointStart);
        waypoints[1] = makeBidirectionalEndPoint(waypointMid);
        waypoints[2] = makeBidirectionalEndPoint(waypointEnd);
        var requestBody = PathfindingEndpoint.adapterRequest.toJson(
                new PathfindingEndpoint.PathfindingRequest(waypoints, "tiny_infra/infra.json", "1"));

        var result = new RsPrint(
                new PathfindingRoutesEndpoint(infraHandlerMock).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody))
        ).printBody();

        var response = PathfindingRoutesEndpoint.adapterResult.fromJson(result);
        assert response != null;

        assertEquals(2, response.routePaths.size());
        assertEquals("rt.buffer_stop_b->tde.foo_b-switch_foo", response.routePaths.get(0).route.id.id);
        assertEquals("rt.tde.foo_b-switch_foo->buffer_stop_c", response.routePaths.get(1).route.id.id);
    }

    @Test
    public void noPathTest() throws IOException {
        var waypointStart = new PathfindingWaypoint(
                "ne.micro.foo_b",
                12,
                EdgeDirection.STOP_TO_START
        );
        var waypointEnd = new PathfindingWaypoint(
                "ne.micro.foo_b",
                13,
                EdgeDirection.STOP_TO_START
        );
        var waypoints = new PathfindingWaypoint[2][1];
        waypoints[0][0] = waypointStart;
        waypoints[1][0] = waypointEnd;
        var requestBody = PathfindingEndpoint.adapterRequest.toJson(
                new PathfindingEndpoint.PathfindingRequest(waypoints, "tiny_infra/infra.json", "1"));

        var res = new RsPrint(new PathfindingRoutesEndpoint(infraHandlerMock).act(
                new RqFake("POST", "/pathfinding/routes", requestBody)
        ));
        assertTrue(res.printHead().contains("400"));
    }

    @Test
    public void simpleRoutesInverted() throws Exception {
        var waypointStart = new PathfindingWaypoint(
                "ne.micro.bar_a",
                100,
                EdgeDirection.START_TO_STOP
        );
        var waypointEnd = new PathfindingWaypoint(
                "ne.micro.foo_b",
                100,
                EdgeDirection.START_TO_STOP
        );
        var waypointsStart = makeBidirectionalEndPoint(waypointStart);
        var waypointsEnd = makeBidirectionalEndPoint(waypointEnd);
        var waypoints = new PathfindingWaypoint[2][];
        waypoints[0] = waypointsStart;
        waypoints[1] = waypointsEnd;
        var requestBody = PathfindingEndpoint.adapterRequest.toJson(
                new PathfindingEndpoint.PathfindingRequest(waypoints, "tiny_infra/infra.json"));

        var result = new RsPrint(
                new PathfindingRoutesEndpoint(infraHandlerMock).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody))
        ).printBody();

        var response = PathfindingRoutesEndpoint.adapterResult.fromJson(result);
        assert response != null;
        expectWaypointInPathResult(response, waypointStart);
        expectWaypointInPathResult(response, waypointEnd);
    }

    /** Tests that we find a route path between two points on the same edge */
    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    public void simpleRoutesSameEdge(boolean inverted) throws Exception {
        var waypointStart = new PathfindingWaypoint(
                "ne.micro.bar_a",
                100,
                EdgeDirection.START_TO_STOP
        );
        var waypointEnd = new PathfindingWaypoint(
                "ne.micro.bar_a",
                110,
                EdgeDirection.START_TO_STOP
        );
        if (inverted) {
            var tmp = waypointEnd;
            waypointEnd = waypointStart;
            waypointStart = tmp;
        }
        var waypointsStart = makeBidirectionalEndPoint(waypointStart);
        var waypointsEnd = makeBidirectionalEndPoint(waypointEnd);
        var waypoints = new PathfindingWaypoint[2][];
        waypoints[0] = waypointsStart;
        waypoints[1] = waypointsEnd;
        var requestBody = PathfindingEndpoint.adapterRequest.toJson(
                new PathfindingEndpoint.PathfindingRequest(waypoints, "tiny_infra/infra.json"));

        var result = new RsPrint(
                new PathfindingRoutesEndpoint(infraHandlerMock).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody))
        ).printBody();

        var response = PathfindingRoutesEndpoint.adapterResult.fromJson(result);
        assert response != null;
        expectWaypointInPathResult(response, waypointStart);
        expectWaypointInPathResult(response, waypointEnd);
    }

    /** Runs a pathfinding on a given infra. Looks into the simulation file to find a possible path */
    private static void runTestOnExampleInfra(String rootPath, boolean inverted) throws Exception {
        var req = requestFromExampleInfra(
                rootPath + "/infra.json",
                rootPath + "/simulation.json",
                inverted
        );
        var requestBody = PathfindingEndpoint.adapterRequest.toJson(req);

        var result = new RsPrint(
                new PathfindingRoutesEndpoint(infraHandlerMock).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody))
        ).printBody();

        var response = PathfindingRoutesEndpoint.adapterResult.fromJson(result);
        assert response != null;
        assertTrue(response.pathWaypoints.size() >= 2);
    }

    @ParameterizedTest
    @MethodSource("provideInfraParameters")
    public void tinyInfraTest(String path, boolean inverted) throws Exception {
        runTestOnExampleInfra(path, inverted);
    }

    static Stream<Arguments> provideInfraParameters() {
        var res = new HashSet<Arguments>();
        var infraPaths = new ArrayList<>(List.of(
                "tiny_infra",
                "one_line",
                "three_trains"
        ));
        for (int i = 0; i < 10; i++)
            infraPaths.add("generated/" + i);
        for (var inverted : new boolean[] {true, false})
            for (var path : infraPaths)
                res.add(Arguments.of(path, inverted));
        return res.stream();
    }

    /** Converts a location into a pair of PathfindingWaypoint (either way) */
    private static PathfindingWaypoint[] convertLocToWaypoint(String trackID, double offset) {
        var res = new PathfindingWaypoint[2];
        for (var dir : EdgeDirection.values())
            res[dir.id] = new PathfindingWaypoint(
                    trackID,
                    offset,
                    dir
            );
        return res;
    }

    /** Generates a pathfinding request from infra + simulation files.
     * The requested path follows the path of a train. */
    private static PathfindingEndpoint.PathfindingRequest requestFromExampleInfra(
            String infraPath,
            String simPath,
            boolean inverted
    ) throws Exception {
        var rjsInfra = Helpers.getExampleInfra(infraPath);
        var infra = ReservationInfraBuilder.fromRJS(rjsInfra);
        var simulation = MoshiUtils.deserialize(RJSSimulation.adapter, getResourcePath(simPath));
        var schedule = simulation.trainSchedules.get(0);
        var endRouteID = schedule.routes[schedule.routes.length - 1].id;
        var endRoute = infra.getReservationRouteMap().get(endRouteID);
        assert endRoute != null;
        var endLoc = endRoute.getTrackRanges().get(endRoute.getTrackRanges().size() - 1).offsetLocation(0);
        var startLoc = schedule.initialHeadLocation;
        var waypoints = new PathfindingWaypoint[2][2];
        var startIndex = inverted ? 1 : 0;
        var endIndex = inverted ? 0 : 1;
        waypoints[startIndex] = convertLocToWaypoint(startLoc.trackSection.id, startLoc.offset);
        waypoints[endIndex] = convertLocToWaypoint(endLoc.track().getID(), endLoc.offset());
        return new PathfindingEndpoint.PathfindingRequest(waypoints, infraPath);
    }
}
