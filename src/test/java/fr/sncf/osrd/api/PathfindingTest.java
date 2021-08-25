package fr.sncf.osrd.api;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
                new PathfindingEndpoint.PathfindingRequest(waypoints, "tiny_infra/infra.json"));

        var result = new RsPrint(
                new PathfindingRoutesEndpoint(infraHandlerMock).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody))
        ).printBody();
        System.out.println(result);

        var response = PathfindingRoutesEndpoint.adapterResult.fromJson(result);
        assert response != null;

        assertEquals(3, response.path.size());
        assertEquals("rt.buffer_stop_b-C3", response.path.get(0).route);
        assertEquals("rt.C3-S7", response.path.get(1).route);
        assertEquals("rt.S7-buffer_stop_c", response.path.get(2).route);

        assertEquals(2, response.steps.size());
        assertEquals("op.station_foo", response.steps.get(0).name);
        assertEquals("op.station_bar", response.steps.get(1).name);
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
    }

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
                new PathfindingEndpoint.PathfindingRequest(waypoints, "tiny_infra/infra.json"));

        var result = new RsPrint(
                new PathfindingRoutesEndpoint(infraHandlerMock).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody))
        ).printBody();

        var response = PathfindingRoutesEndpoint.adapterResult.fromJson(result);
        assert response != null;
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
                new PathfindingRoutesEndpoint.PathfindingRequest(waypoints, "tiny_infra/infra.json"));

        var result = new RsPrint(
                new PathfindingTracksEndpoint(infraHandlerMock).act(
                        new RqFake("POST", "/pathfinding/tracks", requestBody))
        ).printBody();

        var response = PathfindingTracksEndpoint.adapterResult.fromJson(result);
        assert response != null;
        assertEquals(1, response.length);
        assertEquals(3, response[0].length);
    }
}
