package fr.sncf.osrd.api;

import static fr.sncf.osrd.Helpers.getResourcePath;
import static fr.sncf.osrd.Helpers.infraFromRJS;
import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.POSITION_EPSILON;
import static fr.sncf.osrd.utils.takes.TakesUtils.readBodyResponse;
import static fr.sncf.osrd.utils.takes.TakesUtils.readHeadResponse;
import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.PathfindingEndpoint.PathfindingWaypoint;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.implementation.signaling.SignalingInfraBuilder;
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3;
import fr.sncf.osrd.railjson.schema.RJSSimulation;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSLoadingGaugeLimit;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType;
import fr.sncf.osrd.reporting.warnings.WarningRecorderImpl;
import fr.sncf.osrd.train.TestTrains;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.moshi.MoshiUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.takes.rq.RqFake;
import java.io.IOException;
import java.util.*;
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
                final var begin = Math.min(track.getBegin(), track.getEnd());
                final var end = Math.max(track.getBegin(), track.getEnd());
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

        var result = readBodyResponse(
                new PathfindingRoutesEndpoint(infraHandlerMock).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody))
        );

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

        var result = readBodyResponse(new PathfindingRoutesEndpoint(infraHandlerMock).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody)));

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

        var res = readHeadResponse(new PathfindingRoutesEndpoint(infraHandlerMock).act(
                new RqFake("POST", "/pathfinding/routes", requestBody)
        ));
        assert contains400(res);
    }

    @Test
    public void missingTrackTest() throws IOException {
        var waypoint = new PathfindingWaypoint(
                "this_track_does_not_exist",
                0,
                EdgeDirection.STOP_TO_START
        );
        var waypoints = new PathfindingWaypoint[2][1];
        waypoints[0][0] = waypoint;
        waypoints[1][0] = waypoint;
        var requestBody = PathfindingEndpoint.adapterRequest.toJson(
                new PathfindingEndpoint.PathfindingRequest(waypoints, "tiny_infra/infra.json", "1"));
        var res = readHeadResponse(new PathfindingRoutesEndpoint(infraHandlerMock).act(
                new RqFake("POST", "/pathfinding/routes", requestBody)
        ));
        assert contains400(res);
    }

    @Test
    public void incompatibleLoadingGaugeTest() throws Exception {
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
        var waypoints = new PathfindingWaypoint[2][1];
        waypoints[0][0] = waypointStart;
        waypoints[1][0] = waypointEnd;
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        for (var track : rjsInfra.trackSections)
            if (track.getID().equals("ne.micro.foo_to_bar"))
                track.loadingGaugeLimits = List.of(
                        new RJSLoadingGaugeLimit(1000, 2000, RJSLoadingGaugeType.G1)
                );
        var wr = new WarningRecorderImpl(true);
        var infra = SignalingInfraBuilder.fromRJSInfra(
                rjsInfra,
                Set.of(new BAL3(wr)),
                wr
        );
        // Check that we can go through the infra with a small train
        assertNotNull(
                PathfindingRoutesEndpoint.runPathfinding(infra, waypoints, List.of(TestTrains.REALISTIC_FAST_TRAIN))
        );

        // Check that we can't go through the infra with a large train
        assertNull(
                PathfindingRoutesEndpoint.runPathfinding(infra, waypoints, List.of(TestTrains.FAST_TRAIN_LARGE_GAUGE))
        );

        // Check that we can go until right before the blocked section with a large train
        waypoints[1][0] = new PathfindingWaypoint(
                "ne.micro.foo_to_bar",
                999,
                EdgeDirection.START_TO_STOP
        );
        assertNotNull(
                PathfindingRoutesEndpoint.runPathfinding(infra, waypoints, List.of(TestTrains.FAST_TRAIN_LARGE_GAUGE))
        );
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

        var result = readBodyResponse(
                new PathfindingRoutesEndpoint(infraHandlerMock).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody))
        );

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

        var result = readBodyResponse(
                new PathfindingRoutesEndpoint(infraHandlerMock).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody))
        );

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

        var result = readBodyResponse(
                new PathfindingRoutesEndpoint(infraHandlerMock).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody))
        );

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
        var infra = infraFromRJS(rjsInfra);
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

    /** Checks that the waypoints match when converting back and forth into a route offset */
    private static void testMatchingRouteOffsets(SignalingInfra infra, PathfindingWaypoint waypoint) {
        var routeLocations = PathfindingRoutesEndpoint.findRoutes(infra, waypoint);
        for (var loc : routeLocations) {
            var routeRange = new Pathfinding.EdgeRange<>(
                    loc.edge(),
                    loc.offset() / 2,
                    loc.offset() + (loc.edge().getInfraRoute().getLength() - loc.offset()) / 2
            );
            var waypoints = PathfindingResult.getWaypointsOnRoute(routeRange, Set.of(loc.offset()));
            var userDefinedWaypoints = waypoints.stream()
                    .filter(wp -> !wp.suggestion)
                    .toList();
            assertEquals(1, userDefinedWaypoints.size());
            if (waypoint.offset <= 0 || waypoint.offset >= infra.getTrackSection(waypoint.trackSection).getLength()) {
                // Waypoints placed on track transitions can be on either side
                continue;
            }
            assertEquals(waypoint.trackSection, userDefinedWaypoints.get(0).track.id.id);
            assertEquals(waypoint.offset, userDefinedWaypoints.get(0).position, POSITION_EPSILON);
        }
    }

    /** Checks that the waypoints match when converting back and forth into a route offset */
    private static void testAllMatchingRouteOffsets(String infraPath, boolean inverted) throws Exception {
        var req = requestFromExampleInfra(
                infraPath + "/infra.json",
                infraPath + "/simulation.json",
                inverted
        );
        var rjsInfra = Helpers.getExampleInfra(infraPath + "/infra.json");
        var infra = infraFromRJS(rjsInfra);
        for (var waypointList : req.waypoints)
            for (var waypoint : waypointList)
                testMatchingRouteOffsets(infra, waypoint);
    }

    @ParameterizedTest
    @MethodSource("provideInfraParameters")
    public void testMachingRouteOffsets(String path, boolean inverted) throws Exception {
        testAllMatchingRouteOffsets(path, inverted);
    }

    /** Returns true if the response is a 400 */
    private static boolean contains400(List<String> res) {
        var contains400 = false;
        for (var header : res) {
            if (header.contains("400")) {
                contains400 = true;
                break;
            }
        }
        return contains400;
    }
}
