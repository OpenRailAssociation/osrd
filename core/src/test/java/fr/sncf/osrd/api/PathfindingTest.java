package fr.sncf.osrd.api;

import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.api.PathfindingEndpoint.PathfindingWaypoint;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.provider.ValueSource;
import org.takes.rq.RqFake;
import org.takes.rs.RsPrint;


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
                new PathfindingEndpoint.PathfindingRequest(waypoints, "tiny_infra/infra.json", "1"));

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
    @org.junit.jupiter.params.ParameterizedTest
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
                new PathfindingEndpoint.PathfindingRequest(waypoints, "tiny_infra/infra.json", "1"));

        var result = new RsPrint(
                new PathfindingRoutesEndpoint(infraHandlerMock).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody))
        ).printBody();

        var response = PathfindingRoutesEndpoint.adapterResult.fromJson(result);
        assert response != null;
        expectWaypointInPathResult(response, waypointStart);
        expectWaypointInPathResult(response, waypointEnd);
    }

    @Test
    public void simpleTracks() throws Exception {
        var waypointStart = new PathfindingWaypoint(
                "ne.micro.foo_b",
                100,
                EdgeDirection.START_TO_STOP
        );
        var waypointsStart = new PathfindingWaypoint[]{waypointStart};
        var waypointEnd = new PathfindingWaypoint(
                "ne.micro.bar_a",
                100,
                EdgeDirection.START_TO_STOP
        );
        var waypointsEnd = new PathfindingWaypoint[]{waypointEnd};
        var waypoints = new PathfindingWaypoint[2][];
        waypoints[0] = waypointsStart;
        waypoints[1] = waypointsEnd;
        var requestBody = PathfindingRoutesEndpoint.adapterRequest.toJson(
                new PathfindingRoutesEndpoint.PathfindingRequest(waypoints, "tiny_infra/infra.json", "1"));

        var result = new RsPrint(
                new PathfindingTracksEndpoint(infraHandlerMock).act(
                        new RqFake("POST", "/pathfinding/tracks", requestBody))
        ).printBody();

        var response = PathfindingTracksEndpoint.adapterResult.fromJson(result);
        assert response != null;
        assertEquals(1, response.length);
        assertEquals(3, response[0].length);
    }

    /** Tests that we find a track path between two points on the same edge */
    @org.junit.jupiter.params.ParameterizedTest
    @ValueSource(booleans = {true, false})
    public void simpleTracksSameEdge(boolean inverted) throws Exception {
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
        var requestBody = PathfindingRoutesEndpoint.adapterRequest.toJson(
                new PathfindingRoutesEndpoint.PathfindingRequest(waypoints, "tiny_infra/infra.json", "1"));

        var result = new RsPrint(
                new PathfindingTracksEndpoint(infraHandlerMock).act(
                        new RqFake("POST", "/pathfinding/tracks", requestBody))
        ).printBody();

        var response = PathfindingTracksEndpoint.adapterResult.fromJson(result);
        assert response != null;
        assertEquals(1, response.length);
        assertEquals(1, response[0].length);
    }
}
