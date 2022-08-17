package fr.sncf.osrd.api.stdcm;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.api.ExceptionHandler;
import fr.sncf.osrd.api.InfraManager;
import fr.sncf.osrd.api.pathfinding.PathfindingResultConverter;
import fr.sncf.osrd.api.pathfinding.PathfindingRoutesEndpoint;
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.api.pathfinding.response.PathfindingResult;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceValue;
import fr.sncf.osrd.reporting.warnings.WarningRecorderImpl;
import fr.sncf.osrd.standalone_sim.StandaloneSim;
import fr.sncf.osrd.standalone_sim.result.StandaloneSimResult;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeLocation;
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeRange;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.takes.Request;
import org.takes.Response;
import org.takes.Take;
import org.takes.rq.RqPrint;
import org.takes.rs.RsJson;
import org.takes.rs.RsText;
import org.takes.rs.RsWithBody;
import org.takes.rs.RsWithStatus;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.stream.Collectors;


public class STDCMEndpoint implements Take {
    static final Logger logger = LoggerFactory.getLogger(STDCMEndpoint.class);

    private final InfraManager infraManager;

    public static final JsonAdapter<STDCMRequest> adapterRequest = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(RJSRollingResistance.adapter)
            .add(RJSAllowance.adapter)
            .add(RJSAllowanceValue.adapter)
            .build()
            .adapter(STDCMRequest.class);

    public STDCMEndpoint(InfraManager infraManager) {
        this.infraManager = infraManager;
    }

    private static List<EdgeLocation<SignalingRoute>> findRoutes(SignalingInfra infra, PathfindingWaypoint waypoint) {
        var res = new ArrayList<EdgeLocation<SignalingRoute>>();
        var edge = infra.getEdge(waypoint.trackSection, Direction.fromEdgeDir(waypoint.direction));
        assert (edge != null);
        for (var entry : infra.getRoutesOnEdges().get(edge)) {
            var signalingRoutes = infra.getRouteMap().get(entry.route());
            for (var signalingRoute : signalingRoutes) {
                var waypointOffsetFromStart = waypoint.offset;
                if (waypoint.direction.equals(EdgeDirection.STOP_TO_START))
                    waypointOffsetFromStart = edge.getEdge().getLength() - waypoint.offset;
                var offset = waypointOffsetFromStart - entry.startOffset();
                if (offset >= 0 && offset <= signalingRoute.getInfraRoute().getLength())
                    res.add(new EdgeLocation<>(signalingRoute, offset));
            }
        }
        return res;
    }

    private static List<EdgeLocation<SignalingRoute>> findRoutes(SignalingInfra infra, Collection<PathfindingWaypoint> waypoints) {
        var res = new ArrayList<EdgeLocation<SignalingRoute>>();
        for (var waypoint : waypoints)
            res.addAll(findRoutes(infra, waypoint));
        return res;
    }

    private static List<EdgeRange<SignalingRoute>> convertResultPath(
            List<BlockUse> blockUses,
            EdgeLocation<SignalingRoute> startLocation,
            EdgeLocation<SignalingRoute> endLocation
    ) {
        var res = new ArrayList<EdgeRange<SignalingRoute>>();
        for (var blockUse : blockUses) {
            var block = blockUse.block;
            var route = block.route;
            var startOffset = 0.;
            if (route == startLocation.edge())
                startOffset = startLocation.offset();
            var endOffset = block.getLength();
            if (route == endLocation.edge())
                endOffset = endLocation.offset();
            res.add(new EdgeRange<>(route, startOffset, endOffset));
        }
        return res;
    }

    private static TrackLocation routeToTrackLocation(EdgeLocation<SignalingRoute> location) {
        var route = location.edge();
        var routeOffset = location.offset();
        var curOffset = 0.;
        for (var trackRange : route.getInfraRoute().getTrackRanges()) {
            var rangeStartOff = curOffset;
            var rangeEndOff = rangeStartOff + trackRange.getLength();
            curOffset = rangeEndOff;
            if (routeOffset < rangeStartOff || routeOffset > rangeEndOff)
                continue;
            var rangeOffset = routeOffset - rangeStartOff;
            return trackRange.offsetLocation(rangeOffset);
        }
        throw new RuntimeException("failed to convert from route to track offset");
    }

    @Override
    public Response act(Request req) throws
            InvalidRollingStock,
            InvalidSchedule {
        var warningRecorder = new WarningRecorderImpl(false);
        try {
            // Parse request input
            var body = new RqPrint(req).printBody();
            var request = adapterRequest.fromJson(body);
            if (request == null)
                return new RsWithStatus(new RsText("missing request body"), 400);

            var infra = infraManager.load(request.infra, request.expectedVersion, warningRecorder);
            var rollingStock = RJSRollingStockParser.parse(request.rollingStock);
            var startTime = request.startTime;
            var endTime = request.endTime;
            var occupancy = request.RouteOccupancies;

            var startLocations = findRoutes(infra, request.startPoints);
            var endLocations = findRoutes(infra, request.endPoints);

            var waypoints = new PathfindingWaypoint[][] {
                    request.startPoints.toArray(new PathfindingWaypoint[0]),
                    request.endPoints.toArray(new PathfindingWaypoint[0]),
            };
            var expectedPath = PathfindingRoutesEndpoint.runPathfinding(infra, waypoints, List.of(rollingStock));
            for (var route : expectedPath.ranges())
                logger.info("{}", route.edge().getInfraRoute().getID());

            // Compute STDCM
            var stdcmPath = STDCM.run(expectedPath, infra, rollingStock, startTime, endTime, startLocations, endLocations, occupancy);
            // find which start / end location were used
            var startLocMap = new HashMap<SignalingRoute, EdgeLocation<SignalingRoute>>();
            for (var loc : startLocations)
                startLocMap.put(loc.edge(), loc);
            var endLocMap = new HashMap<SignalingRoute, EdgeLocation<SignalingRoute>>();
            for (var loc : endLocations)
                endLocMap.put(loc.edge(), loc);
            var startLocation = startLocMap.get(stdcmPath.get(0).block.route);
            var endLocation = endLocMap.get(stdcmPath.get(stdcmPath.size() - 1).block.route);
            var osrdPath = new Pathfinding.Result<>(convertResultPath(stdcmPath, startLocation, endLocation), List.of());
            var pathfindingRes = PathfindingResultConverter.convert(osrdPath, infra, new WarningRecorderImpl(false));
            var trainSchedule = new StandaloneTrainSchedule(rollingStock, 0., List.of(), List.of(), List.of());
            var signalingRoutePath = stdcmPath.stream().map(blockUse -> blockUse.block.route).collect(Collectors.toList());
            var trainPath = TrainPathBuilder.from(signalingRoutePath, routeToTrackLocation(startLocation), routeToTrackLocation(endLocation));
            var simResult = StandaloneSim.run(
                    infra,
                    trainPath,
                    List.of(trainSchedule),
                    2.
            );
            var result = new STDCMResponse(simResult, pathfindingRes);
            return new RsJson(new RsWithBody(STDCMResponse.adapter.toJson(result)));
        } catch (Throwable ex) {
            return ExceptionHandler.handle(ex);
        }
    }

    public static final class STDCMResponse {
        public static final JsonAdapter<STDCMResponse> adapter = new Moshi
                .Builder()
                .build()
                .adapter(STDCMResponse.class);

        public StandaloneSimResult simulation;

        public PathfindingResult path;

        public STDCMResponse(StandaloneSimResult simulation, PathfindingResult path) {
            this.simulation = simulation;
            this.path = path;
        }
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static final class STDCMRequest {
        /**
         * Infra id
         */
        public String infra;

        /**
         * Infra version
         */
        @Json(name = "expected_version")
        public String expectedVersion;

        /**
         * Rolling stock used for this request
         */
        @Json(name = "rolling_stock")
        public RJSRollingStock rollingStock;

        /**
         * Route occupancies in the given timetable
         */
        @Json(name = "route_occupancies")
        public Collection<RouteOccupancy> RouteOccupancies;

        /**
         * List of possible start points for the train
         */
        @Json(name = "start_points")
        public Collection<PathfindingWaypoint> startPoints;

        /**
         * List of possible start points for the train
         */
        @Json(name = "end_points")
        public Collection<PathfindingWaypoint> endPoints;

        /**
         * Train start time
         */
        @Json(name = "start_time")
        public double startTime;

        /**
         * Train end time
         */
        @Json(name = "end_time")
        public double endTime;

        /**
         * Create a default STDCMRequest
         */
        public STDCMRequest() {
            this(
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    Double.NaN,
                    Double.NaN
            );
        }

        /**
         * Creates a STDCMRequest
         */
        public STDCMRequest(
                String infra,
                String expectedVersion,
                RJSRollingStock rollingStock,
                Collection<RouteOccupancy> routeOccupancies,
                Collection<PathfindingWaypoint> startPoints,
                Collection<PathfindingWaypoint> endPoints,
                double startTime,
                double endTime
        ) {
            this.infra = infra;
            this.expectedVersion = expectedVersion;
            this.rollingStock = rollingStock;
            RouteOccupancies = routeOccupancies;
            this.startPoints = startPoints;
            this.endPoints = endPoints;
            this.startTime = startTime;
            this.endTime = endTime;
        }
    }

    public static class RouteOccupancy {
        /**
         * ID of the occupied route
         */
        public String id;

        /**
         * Time at which the route starts being occupied
         */
        @Json(name = "start_occupancy_time")
        public double startOccupancyTime;

        /**
         * Time at which the route ends being occupied
         */
        @Json(name = "end_occupancy_time")
        public double endOccupancyTime;

        public RouteOccupancy(String id, double startOccupancyTime, double endOccupancyTime) {
            this.id = id;
            this.startOccupancyTime = startOccupancyTime;
            this.endOccupancyTime = endOccupancyTime;
        }
    }
}

