package fr.sncf.osrd.api;

import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.utils.graph.EdgeDirection;
import org.junit.jupiter.api.Test;
import org.takes.rq.RqFake;
import org.takes.rs.RsPrint;

public class PathfindingTest extends ApiTest {
    @Test
    public void simpleRoutes() throws Exception {
        var waypointStart = new PathfindingEndpoint.PathfindingWaypoint(
                "ne.micro.foo_b",
                100,
                EdgeDirection.START_TO_STOP
        );
        var waypointsStart = new PathfindingEndpoint.PathfindingWaypoint[]{waypointStart};
        var waypointEnd = new PathfindingEndpoint.PathfindingWaypoint(
                "ne.micro.bar_a",
                100,
                EdgeDirection.START_TO_STOP
        );
        var waypointsEnd = new PathfindingEndpoint.PathfindingWaypoint[]{waypointEnd};
        var waypoints = new PathfindingEndpoint.PathfindingWaypoint[2][];
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

        assertEquals(2, response.operationalPoints.size());
        assertEquals("op.station_foo", response.operationalPoints.get(0).op);
        assertEquals("op.station_bar", response.operationalPoints.get(1).op);
    }

    @Test
    public void simpleTracks() throws Exception {
        var waypointStart = new PathfindingEndpoint.PathfindingWaypoint(
                "ne.micro.foo_b",
                100,
                EdgeDirection.START_TO_STOP
        );
        var waypointsStart = new PathfindingEndpoint.PathfindingWaypoint[]{waypointStart};
        var waypointEnd = new PathfindingEndpoint.PathfindingWaypoint(
                "ne.micro.bar_a",
                100,
                EdgeDirection.START_TO_STOP
        );
        var waypointsEnd = new PathfindingEndpoint.PathfindingWaypoint[]{waypointEnd};
        var waypoints = new PathfindingEndpoint.PathfindingWaypoint[2][];
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
