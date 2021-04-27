package fr.sncf.osrd.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import fr.sncf.osrd.config.JsonConfig;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import org.junit.jupiter.api.Test;
import org.takes.rq.RqFake;
import org.takes.rs.RsPrint;

import java.io.IOException;

public class PathfindingTest {
    private Infra getInfra(String infra) throws InvalidInfraException, IOException {
        ClassLoader classLoader = getClass().getClassLoader();
        var infraPath = classLoader.getResource(infra);
        assert infraPath != null;
        return Infra.parseFromFile(JsonConfig.InfraType.UNKNOWN, infraPath.getFile());
    }

    @Test
    public void simpleRoutes() throws Exception {
        var infra = getInfra("tiny_infra/infra.json");

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
                new PathfindingEndpoint.PathfindingRequest(waypoints));

        var result = new RsPrint(
                new PathfindingRoutesEndpoint(infra).act(new RqFake("POST", "/pathfinding/routes", requestBody))
        ).printBody();

        var response = PathfindingRoutesEndpoint.adapterResult.fromJson(result);
        assert response != null;
        assertEquals(1, response.length);
        assertEquals(4, response[0].routes.size());
        assertEquals(3, response[0].trackSections.size());
    }

    @Test
    public void simpleTracks() throws Exception {
        var infra = getInfra("tiny_infra/infra.json");

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
                new PathfindingRoutesEndpoint.PathfindingRequest(waypoints));

        var result = new RsPrint(
                new PathfindingTracksEndpoint(infra).act(new RqFake("POST", "/pathfinding/tracks", requestBody))
        ).printBody();

        var response = PathfindingTracksEndpoint.adapterResult.fromJson(result);
        assert response != null;
        assertEquals(1, response.length);
        assertEquals(3, response[0].length);
    }
}
