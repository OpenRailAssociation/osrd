package fr.sncf.osrd.api.pathfinding;

import static fr.sncf.osrd.Helpers.fullInfraFromRJS;
import static fr.sncf.osrd.Helpers.getResourcePath;
import static fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection.START_TO_STOP;
import static fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection.STOP_TO_START;
import static fr.sncf.osrd.utils.KtToJavaConverter.toIntList;
import static fr.sncf.osrd.utils.indexing.DirStaticIdxKt.toValue;
import static fr.sncf.osrd.utils.takes.TakesUtils.readBodyResponse;
import static fr.sncf.osrd.utils.takes.TakesUtils.readHeadResponse;
import static org.assertj.core.api.AssertionsForClassTypes.assertThat;
import static org.assertj.core.api.AssertionsForClassTypes.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.ApiTest;
import fr.sncf.osrd.api.pathfinding.request.PathfindingRequest;
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.api.pathfinding.response.CurveChartPointResult;
import fr.sncf.osrd.api.pathfinding.response.PathWaypointResult;
import fr.sncf.osrd.api.pathfinding.response.PathfindingResult;
import fr.sncf.osrd.api.pathfinding.response.SlopeChartPointResult;
import fr.sncf.osrd.cli.StandaloneSimulationCommand;
import fr.sncf.osrd.railjson.schema.common.graph.ApplicableDirection;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.railjson.schema.infra.RJSRoutePath;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSApplicableDirectionsTrackRange;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSCatenary;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSDirectionalTrackRange;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSLoadingGaugeLimit;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.train.TestTrains;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.moshi.MoshiUtils;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.takes.Response;
import org.takes.rq.RqFake;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;


public class PathfindingTest extends ApiTest {

    private static final String SIGNALING_TYPE = "BAL3";

    private static PathfindingWaypoint[] makeBidirectionalEndPoint(PathfindingWaypoint point) {
        var waypointInverted = new PathfindingWaypoint(
                point.trackSection,
                point.offset,
                point.direction.opposite()
        );
        return new PathfindingWaypoint[]{point, waypointInverted};
    }

    private static void expectWaypointInPathResult(
            PathfindingResult result,
            PathfindingWaypoint waypoint
    ) {
        for (var route : result.routePaths) {
            for (var track : route.trackSections) {
                if (!track.trackSectionID.equals(waypoint.trackSection))
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
        var waypointStart = new PathfindingWaypoint("ne.micro.foo_b", 50, START_TO_STOP);
        var waypointEnd = new PathfindingWaypoint("ne.micro.bar_a", 100, START_TO_STOP);
        var waypointsStart = makeBidirectionalEndPoint(waypointStart);
        var waypointsEnd = makeBidirectionalEndPoint(waypointEnd);
        var waypoints = new PathfindingWaypoint[2][];
        waypoints[0] = waypointsStart;
        waypoints[1] = waypointsEnd;
        var requestBody = PathfindingRequest.adapter.toJson(
                new PathfindingRequest(waypoints, "tiny_infra/infra.json", "1", null));

        var result = readBodyResponse(
                new PathfindingBlocksEndpoint(infraManager).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody))
        );

        var response = PathfindingResult.adapterResult.fromJson(result);

        assert response != null;
        assertThat(response.length).isEqualTo(10250.);
        var expectedRoutePaths = List.of(
                new RJSRoutePath("rt.buffer_stop_b->tde.foo_b-switch_foo",
                        List.of(new RJSDirectionalTrackRange("ne.micro.foo_b", 50, 175, START_TO_STOP)),
                        SIGNALING_TYPE),
                new RJSRoutePath("rt.tde.foo_b-switch_foo->buffer_stop_c",
                        List.of(new RJSDirectionalTrackRange("ne.micro.foo_b", 175, 200, START_TO_STOP),
                                new RJSDirectionalTrackRange("ne.micro.foo_to_bar", 0, 10000, START_TO_STOP),
                                new RJSDirectionalTrackRange("ne.micro.bar_a", 0, 100, START_TO_STOP)),
                        SIGNALING_TYPE)
        );
        assertThat(response.routePaths).isEqualTo(expectedRoutePaths);
        var expectedPathWaypoints = List.of(
                new PathWaypointResult(new PathWaypointResult.PathWaypointLocation("ne.micro.foo_b", 50.0),
                        0.0, false, null),
                new PathWaypointResult(new PathWaypointResult.PathWaypointLocation("ne.micro.foo_b", 100.0),
                        50.0, true, "op.station_foo"),
                new PathWaypointResult(new PathWaypointResult.PathWaypointLocation("ne.micro.bar_a", 100.0),
                        10250.0, false, "op.station_bar")
        );
        assertThat(response.pathWaypoints).isEqualTo(expectedPathWaypoints);
    }

    @Test
    public void testMiddleStop() throws Exception {
        var waypointStart = new PathfindingWaypoint("ne.micro.foo_b", 100, START_TO_STOP);
        var waypointMid = new PathfindingWaypoint("ne.micro.foo_to_bar", 5000, START_TO_STOP);
        var waypointEnd = new PathfindingWaypoint("ne.micro.bar_a", 100, START_TO_STOP);
        var waypoints = new PathfindingWaypoint[3][];
        waypoints[0] = makeBidirectionalEndPoint(waypointStart);
        waypoints[1] = makeBidirectionalEndPoint(waypointMid);
        waypoints[2] = makeBidirectionalEndPoint(waypointEnd);
        var requestBody = PathfindingRequest.adapter.toJson(
                new PathfindingRequest(waypoints, "tiny_infra/infra.json", "1", null));

        var result = readBodyResponse(new PathfindingBlocksEndpoint(infraManager).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody)));

        var response = PathfindingResult.adapterResult.fromJson(result);

        assert response != null;
        assertThat(response.length).isEqualTo(10200.);
        var expectedRoutePaths = List.of(
                new RJSRoutePath("rt.buffer_stop_b->tde.foo_b-switch_foo",
                        List.of(new RJSDirectionalTrackRange("ne.micro.foo_b", 100, 175, START_TO_STOP)),
                        SIGNALING_TYPE),
                new RJSRoutePath("rt.tde.foo_b-switch_foo->buffer_stop_c",
                        List.of(new RJSDirectionalTrackRange("ne.micro.foo_b", 175, 200, START_TO_STOP),
                                new RJSDirectionalTrackRange("ne.micro.foo_to_bar", 0, 10000, START_TO_STOP),
                                new RJSDirectionalTrackRange("ne.micro.bar_a", 0, 100, START_TO_STOP)),
                        SIGNALING_TYPE)
        );
        assertThat(response.routePaths).isEqualTo(expectedRoutePaths);
        var expectedPathWaypoints = List.of(
                new PathWaypointResult(new PathWaypointResult.PathWaypointLocation("ne.micro.foo_b", 100.0),
                        0.0, false, "op.station_foo"),
                new PathWaypointResult(new PathWaypointResult.PathWaypointLocation("ne.micro.foo_to_bar", 5000.0),
                        5100.0, false, null),
                new PathWaypointResult(new PathWaypointResult.PathWaypointLocation("ne.micro.bar_a", 100.0),
                        10200, false, "op.station_bar")
        );
        assertThat(response.pathWaypoints).isEqualTo(expectedPathWaypoints);
    }

    @Test
    @DisplayName("If no path exists, throws a generic error message")
    public void noPathTest() throws Exception {
        var waypointStart = new PathfindingWaypoint("ne.micro.foo_b", 12, STOP_TO_START);
        var waypointEnd = new PathfindingWaypoint("ne.micro.foo_b", 13, STOP_TO_START);
        var waypoints = new PathfindingWaypoint[2][1];
        waypoints[0][0] = waypointStart;
        waypoints[1][0] = waypointEnd;
        var requestBody = PathfindingRequest.adapter.toJson(
                new PathfindingRequest(waypoints, "tiny_infra/infra.json", "1", null));

        var res = readHeadResponse(new PathfindingBlocksEndpoint(infraManager).act(
                new RqFake("POST", "/pathfinding/routes", requestBody)
        ));
        assertThat(res.get(0)).contains("400");

        var infra = Helpers.getTinyInfra();
        assertThatThrownBy(() -> PathfindingBlocksEndpoint.runPathfinding(infra, waypoints, List.of()))
                .isExactlyInstanceOf(OSRDError.class)
                .satisfies(exception -> {
                    assertThat(((OSRDError) exception).osrdErrorType).isEqualTo(ErrorType.PathfindingGenericError);
                    assertThat(((OSRDError) exception).context).isEqualTo(new HashMap<>());
                });
    }

    @Test
    public void missingTrackTest() throws IOException {
        var waypoint = new PathfindingWaypoint("this_track_does_not_exist", 0, STOP_TO_START);
        var waypoints = new PathfindingWaypoint[2][1];
        waypoints[0][0] = waypoint;
        waypoints[1][0] = waypoint;

        var requestBody = PathfindingRequest.adapter.toJson(
                new PathfindingRequest(waypoints, "tiny_infra/infra.json", "1", null));
        Response response = new PathfindingBlocksEndpoint(infraManager).act(
                new RqFake("POST", "/pathfinding/routes", requestBody));
        var res = readHeadResponse(response);
        assertThat(res.get(0)).contains("400");

        var infra = Helpers.getTinyInfra();
        assertThatThrownBy(() -> PathfindingBlocksEndpoint.runPathfinding(infra, waypoints, List.of()))
                .isExactlyInstanceOf(OSRDError.class)
                .satisfies(exception -> {
                    assertThat(((OSRDError) exception).osrdErrorType).isEqualTo(ErrorType.UnknownTrackSection);
                    assertThat(((OSRDError) exception).context)
                            .isEqualTo(Map.of("track_section_id", "this_track_does_not_exist"));
                });
    }

    @Test
    public void incompatibleLoadingGaugeTest() throws Exception {
        var waypointStart = new PathfindingWaypoint("ne.micro.foo_b", 100, START_TO_STOP);
        var waypointEnd = new PathfindingWaypoint("ne.micro.bar_a", 100, START_TO_STOP);
        var waypoints = new PathfindingWaypoint[2][1];
        waypoints[0][0] = waypointStart;
        waypoints[1][0] = waypointEnd;
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        for (var track : rjsInfra.trackSections)
            if (track.getID().equals("ne.micro.foo_to_bar"))
                track.loadingGaugeLimits = List.of(
                        new RJSLoadingGaugeLimit(1000, 2000, RJSLoadingGaugeType.G1)
                );
        var infra = fullInfraFromRJS(rjsInfra);

        // Check that we can go through the infra with a small train
        assertThat(PathfindingBlocksEndpoint.runPathfinding(infra, waypoints, List.of(TestTrains.REALISTIC_FAST_TRAIN)))
                .isNotNull();

        // Check that we can't go through the infra with a large train
        assertThatThrownBy(() -> PathfindingBlocksEndpoint.runPathfinding(
                infra,
                waypoints,
                List.of(TestTrains.FAST_TRAIN_LARGE_GAUGE)
        ))
                .isExactlyInstanceOf(OSRDError.class)
                .satisfies(exception -> {
                    assertThat(((OSRDError) exception).osrdErrorType).isEqualTo(ErrorType.PathfindingGaugeError);
                    assertThat(((OSRDError) exception).context).isEqualTo(Map.of());
                });

        // Check that we can go until right before the blocked section with a large train
        waypoints[1][0] = new PathfindingWaypoint("ne.micro.foo_to_bar", 999, START_TO_STOP);
        assertThat(PathfindingBlocksEndpoint.runPathfinding(infra, waypoints,
                List.of(TestTrains.FAST_TRAIN_LARGE_GAUGE)))
                .isNotNull();
    }

    @Test
    public void differentPathsDueToElectrificationConstraints() throws Exception {
        var waypointStart = new PathfindingWaypoint("TA1", 1550, START_TO_STOP);
        var waypointEnd = new PathfindingWaypoint("TH0", 103, START_TO_STOP);
        var waypoints = new PathfindingWaypoint[2][1];
        waypoints[0][0] = waypointStart;
        waypoints[1][0] = waypointEnd;
        var rjsInfra = Helpers.getExampleInfra("small_infra/infra.json");

        // Run a pathfinding with a non-electric train
        var infra = Helpers.fullInfraFromRJS(rjsInfra);
        var normalPath = PathfindingBlocksEndpoint.runPathfinding(
                infra, waypoints, List.of(TestTrains.REALISTIC_FAST_TRAIN)
        );

        // Replace with custom catenaries
        // Set voltage to 25000 everywhere except for trackSectionToBlock
        var trackSectionToBlock = normalPath.ranges().stream()
                .map(Pathfinding.EdgeRange::edge)
                .flatMap(block -> toIntList(infra.blockInfra().getTrackChunksFromBlock(block)).stream()
                        .map(dirChunk -> infra.rawInfra().getTrackSectionName(
                                infra.rawInfra().getTrackFromChunk(toValue(dirChunk)))))
                .filter(trackName -> trackName.startsWith("TD"))
                .findFirst().get();
        var voltageTrackRanges = rjsInfra.trackSections.stream()
                .filter(rjsTrackSection -> !Objects.equals(rjsTrackSection.id, trackSectionToBlock))
                .map(rjsTrackSection -> new RJSApplicableDirectionsTrackRange(rjsTrackSection.id,
                        ApplicableDirection.BOTH, 0, rjsTrackSection.length))
                .collect(Collectors.toList());
        var voltageCatenary = new RJSCatenary("25000", voltageTrackRanges);
        var noVoltageCatenary = new RJSCatenary("",
                List.of(new RJSApplicableDirectionsTrackRange(trackSectionToBlock, ApplicableDirection.BOTH, 0,
                        rjsInfra.trackSections.stream()
                                .filter(rjsTrackSection -> Objects.equals(rjsTrackSection.id, trackSectionToBlock))
                                .findFirst().get().length)));
        rjsInfra.catenaries = new ArrayList<>(List.of(voltageCatenary, noVoltageCatenary));
        var infraWithNonElectrifiedTrack = Helpers.fullInfraFromRJS(rjsInfra);

        // Run another pathfinding with an electric train
        var electricPath = PathfindingBlocksEndpoint.runPathfinding(
                infraWithNonElectrifiedTrack,
                waypoints,
                List.of(TestTrains.FAST_ELECTRIC_TRAIN)
        );

        // Check that the paths are different, we need to avoid the non-electrified track
        assertThat(normalPath).isNotNull();
        assertThat(electricPath).isNotNull();
        assertThat(normalPath).usingRecursiveComparison().isNotEqualTo(electricPath);
    }

    @Test
    public void noElectrificationThrowsForElectricTrain() throws IOException, URISyntaxException {
        var waypointStart = new PathfindingWaypoint("TA1", 1550, START_TO_STOP);
        var waypointEnd = new PathfindingWaypoint("TH0", 103, START_TO_STOP);
        var waypoints = new PathfindingWaypoint[2][1];
        waypoints[0][0] = waypointStart;
        waypoints[1][0] = waypointEnd;
        var rjsInfra = Helpers.getExampleInfra("small_infra/infra.json");
        rjsInfra.catenaries = new ArrayList<>();

        assertThatThrownBy(() -> PathfindingBlocksEndpoint.runPathfinding(
                Helpers.fullInfraFromRJS(rjsInfra),
                waypoints,
                List.of(TestTrains.FAST_ELECTRIC_TRAIN)
        ))
                .isExactlyInstanceOf(OSRDError.class)
                .satisfies(exception -> {
                    assertThat(((OSRDError) exception).osrdErrorType)
                            .isEqualTo(ErrorType.PathfindingElectrificationError);
                    assertThat(((OSRDError) exception).context).isEqualTo(Map.of());
                });
    }

    @Test
    public void simpleRoutesInverted() throws Exception {
        var waypointStart = new PathfindingWaypoint("ne.micro.bar_a", 100, START_TO_STOP);
        var waypointEnd = new PathfindingWaypoint("ne.micro.foo_b", 100, START_TO_STOP);
        var waypointsStart = makeBidirectionalEndPoint(waypointStart);
        var waypointsEnd = makeBidirectionalEndPoint(waypointEnd);
        var waypoints = new PathfindingWaypoint[2][];
        waypoints[0] = waypointsStart;
        waypoints[1] = waypointsEnd;
        var requestBody = PathfindingRequest.adapter.toJson(
                new PathfindingRequest(waypoints, "tiny_infra/infra.json", null, null));

        var result = readBodyResponse(
                new PathfindingBlocksEndpoint(infraManager).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody))
        );

        var response = PathfindingResult.adapterResult.fromJson(result);
        assert response != null;
        var expectedRoutePaths = List.of(
                new RJSRoutePath("rt.buffer_stop_c->tde.track-bar",
                        List.of(new RJSDirectionalTrackRange("ne.micro.bar_a", 25, 100, STOP_TO_START)),
                        SIGNALING_TYPE),
                new RJSRoutePath("rt.tde.track-bar->tde.switch_foo-track",
                        List.of(new RJSDirectionalTrackRange("ne.micro.bar_a", 0.0, 25.0, STOP_TO_START),
                                new RJSDirectionalTrackRange("ne.micro.foo_to_bar", 25.0, 10000, STOP_TO_START)),
                        SIGNALING_TYPE),
                new RJSRoutePath("rt.tde.switch_foo-track->buffer_stop_b",
                        List.of(new RJSDirectionalTrackRange("ne.micro.foo_to_bar", 0.0, 25.0, STOP_TO_START),
                                new RJSDirectionalTrackRange("ne.micro.foo_b", 100.0, 200, STOP_TO_START)),
                        SIGNALING_TYPE)
        );
        assertThat(response.routePaths).isEqualTo(expectedRoutePaths);
        var expectedPathWaypoints = List.of(
                new PathWaypointResult(new PathWaypointResult.PathWaypointLocation("ne.micro.bar_a", 125.0),
                        0.0, false, "op.station_bar"),
                new PathWaypointResult(new PathWaypointResult.PathWaypointLocation("ne.micro.foo_b", 75.0),
                        10200.0, false, "op.station_foo")
        );
        assertThat(response.pathWaypoints).isEqualTo(expectedPathWaypoints);
        expectWaypointInPathResult(response, waypointStart);
        expectWaypointInPathResult(response, waypointEnd);
    }

    /** Tests that we find a route path between two points on the same edge */
    @ParameterizedTest
    @MethodSource("simpleRoutesSameEdgeArgs")
    public void simpleRoutesSameEdge(boolean inverted, List<RJSRoutePath> expectedRoutePaths,
                                     List<PathWaypointResult> expectedPathWaypoints) throws Exception {
        var waypointStart = new PathfindingWaypoint("ne.micro.bar_a", 100, START_TO_STOP);
        var waypointEnd = new PathfindingWaypoint("ne.micro.bar_a", 110, START_TO_STOP);
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
        var requestBody = PathfindingRequest.adapter.toJson(
                new PathfindingRequest(waypoints, "tiny_infra/infra.json", null, null));

        var result = readBodyResponse(
                new PathfindingBlocksEndpoint(infraManager).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody))
        );

        var response = PathfindingResult.adapterResult.fromJson(result);
        assert response != null;
        assertThat(response.routePaths).isEqualTo(expectedRoutePaths);
        assertThat(response.pathWaypoints).isEqualTo(expectedPathWaypoints);
        expectWaypointInPathResult(response, waypointStart);
        expectWaypointInPathResult(response, waypointEnd);
    }

    static Stream<Arguments> simpleRoutesSameEdgeArgs() {
        return Stream.of(
                Arguments.of(
                        true,
                        List.of(new RJSRoutePath("rt.buffer_stop_c->tde.track-bar",
                                List.of(new RJSDirectionalTrackRange("ne.micro.bar_a", 100, 110, STOP_TO_START)),
                                SIGNALING_TYPE)),
                        List.of(
                                new PathWaypointResult(
                                        new PathWaypointResult.PathWaypointLocation("ne.micro.bar_a", 115.0),
                                        0.0, false, null),
                                new PathWaypointResult(
                                        new PathWaypointResult.PathWaypointLocation("ne.micro.bar_a", 125.0),
                                        10.0, false, "op.station_bar")
                        )
                ),
                Arguments.of(
                        false,
                        List.of(new RJSRoutePath("rt.tde.foo_a-switch_foo->buffer_stop_c",
                                List.of(new RJSDirectionalTrackRange("ne.micro.bar_a", 100, 110, START_TO_STOP)),
                                SIGNALING_TYPE)),
                        List.of(
                                new PathWaypointResult(
                                        new PathWaypointResult.PathWaypointLocation("ne.micro.bar_a", 100.0),
                                        0.0, false, "op.station_bar"),
                                new PathWaypointResult(
                                        new PathWaypointResult.PathWaypointLocation("ne.micro.bar_a", 110.0),
                                        10.0, false, null)
                        )
                )
        );
    }

    @ParameterizedTest
    @MethodSource("provideInfraParameters")
    public void tinyInfraTest(String path, boolean inverted) throws Exception {
        runTestOnExampleInfra(path, inverted);
    }

    /** Runs a pathfinding on a given infra. Looks into the simulation file to find a possible path */
    private void runTestOnExampleInfra(String rootPath, boolean inverted) throws Exception {
        var req = requestFromExampleInfra(
                rootPath + "/infra.json",
                rootPath + "/simulation.json",
                inverted
        );
        var requestBody = PathfindingRequest.adapter.toJson(req);

        var result = readBodyResponse(
                new PathfindingBlocksEndpoint(infraManager).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody))
        );

        var response = PathfindingResult.adapterResult.fromJson(result);
        assert response != null;
        assertTrue(response.pathWaypoints.size() >= 2);
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

    /** Generates a pathfinding request from infra + simulation files.
     * The requested path follows the path of a train. */
    private static PathfindingRequest requestFromExampleInfra(
            String infraPath,
            String simPath,
            boolean inverted
    ) throws Exception {
        var simulation = MoshiUtils.deserialize(StandaloneSimulationCommand.Input.adapter,
                getResourcePath(simPath));
        var scheduleGroup = simulation.trainScheduleGroups.get(0);
        var waypoints = new PathfindingWaypoint[2][2];
        var startIndex = inverted ? 1 : 0;
        var endIndex = inverted ? 0 : 1;
        waypoints[startIndex] = scheduleGroup.waypoints[0];
        waypoints[endIndex] = scheduleGroup.waypoints[scheduleGroup.waypoints.length - 1];
        return new PathfindingRequest(waypoints, infraPath, null, null);
    }

    @Test
    public void testCurveGraph() throws IOException {
        var waypointStart = new PathfindingWaypoint("TF1", 0, EdgeDirection.START_TO_STOP);
        var waypointEnd = new PathfindingWaypoint("TF1", 6500, EdgeDirection.START_TO_STOP);
        var waypointsStart = makeBidirectionalEndPoint(waypointStart);
        var waypointsEnd = makeBidirectionalEndPoint(waypointEnd);
        var waypoints = new PathfindingWaypoint[2][];
        waypoints[0] = waypointsStart;
        waypoints[1] = waypointsEnd;
        var requestBody = PathfindingRequest.adapter.toJson(
                new PathfindingRequest(waypoints, "small_infra/infra.json", "1", null));

        var result = readBodyResponse(
                new PathfindingBlocksEndpoint(infraManager).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody))
        );
        var response = PathfindingResult.adapterResult.fromJson(result);
        assert response != null;
        assertIterableEquals(
                Arrays.asList(
                        new CurveChartPointResult(0, 0),
                        new CurveChartPointResult(3100, 0),
                        new CurveChartPointResult(3100, 9500),
                        new CurveChartPointResult(4400, 9500),
                        new CurveChartPointResult(4400, 0),
                        new CurveChartPointResult(6500, 0)
                ),
                response.curves
        );
    }

    @Test
    public void testCurveGraphStopToStart() throws IOException {
        var waypointStart = new PathfindingWaypoint("TF1", 6500, EdgeDirection.STOP_TO_START);
        var waypointEnd = new PathfindingWaypoint("TF1", 0, EdgeDirection.STOP_TO_START);
        var waypointsStart = makeBidirectionalEndPoint(waypointStart);
        var waypointsEnd = makeBidirectionalEndPoint(waypointEnd);
        var waypoints = new PathfindingWaypoint[2][];
        waypoints[0] = waypointsStart;
        waypoints[1] = waypointsEnd;
        var requestBody = PathfindingRequest.adapter.toJson(
                new PathfindingRequest(waypoints, "small_infra/infra.json", "1", null));

        var result = readBodyResponse(
                new PathfindingBlocksEndpoint(infraManager).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody))
        );
        var response = PathfindingResult.adapterResult.fromJson(result);
        assert response != null;
        assertIterableEquals(
                Arrays.asList(
                        new CurveChartPointResult(0, 0),
                        new CurveChartPointResult(2100, 0),
                        new CurveChartPointResult(2100, -9500),
                        new CurveChartPointResult(3400, -9500),
                        new CurveChartPointResult(3400, 0),
                        new CurveChartPointResult(6500, 0)
                ),
                response.curves
        );
    }

    @Test
    public void testSlopeGraph() throws IOException {
        var waypointStart = new PathfindingWaypoint("TD0", 0, EdgeDirection.START_TO_STOP);
        var waypointEnd = new PathfindingWaypoint("TD0", 25000, EdgeDirection.START_TO_STOP);
        var waypointsStart = makeBidirectionalEndPoint(waypointStart);
        var waypointsEnd = makeBidirectionalEndPoint(waypointEnd);
        var waypoints = new PathfindingWaypoint[2][];
        waypoints[0] = waypointsStart;
        waypoints[1] = waypointsEnd;
        var requestBody = PathfindingRequest.adapter.toJson(
                new PathfindingRequest(waypoints, "small_infra/infra.json", "1", null));

        var result = readBodyResponse(
                new PathfindingBlocksEndpoint(infraManager).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody))
        );
        var response = PathfindingResult.adapterResult.fromJson(result);
        assert response != null;
        assertIterableEquals(
                Arrays.asList(
                        new SlopeChartPointResult(0, 0),
                        new SlopeChartPointResult(6000, 0),
                        new SlopeChartPointResult(6000, 3),
                        new SlopeChartPointResult(7000, 3),
                        new SlopeChartPointResult(7000, 6),
                        new SlopeChartPointResult(8000, 6),
                        new SlopeChartPointResult(8000, 3),
                        new SlopeChartPointResult(9000, 3),
                        new SlopeChartPointResult(9000, 0),
                        new SlopeChartPointResult(14000, 0),
                        new SlopeChartPointResult(14000, -3),
                        new SlopeChartPointResult(15000, -3),
                        new SlopeChartPointResult(15000, -6),
                        new SlopeChartPointResult(16000, -6),
                        new SlopeChartPointResult(16000, -3),
                        new SlopeChartPointResult(17000, -3),
                        new SlopeChartPointResult(17000, 0),
                        new SlopeChartPointResult(25000, 0)
                ),
                response.slopes
        );
    }

    @Test
    public void testSlopeGraphStopToStart() throws IOException {
        var waypointStart = new PathfindingWaypoint("TD0", 25000, EdgeDirection.STOP_TO_START);
        var waypointEnd = new PathfindingWaypoint("TD0", 0, EdgeDirection.STOP_TO_START);
        var waypointsStart = makeBidirectionalEndPoint(waypointStart);
        var waypointsEnd = makeBidirectionalEndPoint(waypointEnd);
        var waypoints = new PathfindingWaypoint[2][];
        waypoints[0] = waypointsStart;
        waypoints[1] = waypointsEnd;
        var requestBody = PathfindingRequest.adapter.toJson(
                new PathfindingRequest(waypoints, "small_infra/infra.json", "1", null));

        var result = readBodyResponse(
                new PathfindingBlocksEndpoint(infraManager).act(
                        new RqFake("POST", "/pathfinding/routes", requestBody))
        );
        var response = PathfindingResult.adapterResult.fromJson(result);
        assert response != null;
        assertIterableEquals(
                Arrays.asList(
                        new SlopeChartPointResult(0, 0),
                        new SlopeChartPointResult(8000, 0),
                        new SlopeChartPointResult(8000, 3),
                        new SlopeChartPointResult(9000, 3),
                        new SlopeChartPointResult(9000, 6),
                        new SlopeChartPointResult(10000, 6),
                        new SlopeChartPointResult(10000, 3),
                        new SlopeChartPointResult(11000, 3),
                        new SlopeChartPointResult(11000, 0),
                        new SlopeChartPointResult(16000, 0),
                        new SlopeChartPointResult(16000, -3),
                        new SlopeChartPointResult(17000, -3),
                        new SlopeChartPointResult(17000, -6),
                        new SlopeChartPointResult(18000, -6),
                        new SlopeChartPointResult(18000, -3),
                        new SlopeChartPointResult(19000, -3),
                        new SlopeChartPointResult(19000, 0),
                        new SlopeChartPointResult(25000, 0)
                ),
                response.slopes
        );
    }
}
