package fr.sncf.osrd.api.pathfinding;

import static fr.sncf.osrd.api.pathfinding.RemainingDistanceEstimator.minDistanceBetweenSteps;

import fr.sncf.osrd.api.ExceptionHandler;
import fr.sncf.osrd.api.InfraManager;
import fr.sncf.osrd.api.pathfinding.constraints.ElectrificationConstraints;
import fr.sncf.osrd.api.pathfinding.constraints.LoadingGaugeConstraints;
import fr.sncf.osrd.api.pathfinding.request.PathfindingRequest;
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.api.pathfinding.response.NoPathFoundError;
import fr.sncf.osrd.api.pathfinding.response.PathfindingResult;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.GraphAdapter;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.graph.functional_interfaces.AStarHeuristic;
import fr.sncf.osrd.utils.graph.functional_interfaces.EdgeToRanges;
import org.takes.Request;
import org.takes.Response;
import org.takes.Take;
import org.takes.rq.RqPrint;
import org.takes.rs.RsJson;
import org.takes.rs.RsText;
import org.takes.rs.RsWithBody;
import org.takes.rs.RsWithStatus;
import java.util.*;
import java.util.stream.Collectors;


public class PathfindingRoutesEndpoint implements Take {
    private final InfraManager infraManager;
    private static final HashMap<Class<?>, String> constraints = new HashMap<>();
    public static final String PATH_FINDING_GENERIC_ERROR = "No path could be found";
    public static final String PATH_FINDING_GAUGE_ERROR = "No path could be found after loading Gauge constraints";
    public static final String PATH_FINDING_ELECTRIFICATION_ERROR =
            "No path could be found after loading Electrification constraints";

    static {
        constraints.put(LoadingGaugeConstraints.class, PATH_FINDING_GAUGE_ERROR);
        constraints.put(ElectrificationConstraints.class, PATH_FINDING_ELECTRIFICATION_ERROR);
    }

    /**
     * constructor
     */
    public PathfindingRoutesEndpoint(InfraManager infraHandler) {
        this.infraManager = infraHandler;
    }

    @Override
    public Response act(Request req) {
        var recorder = new DiagnosticRecorderImpl(false);
        try {
            var body = new RqPrint(req).printBody();
            var request = PathfindingRequest.adapter.fromJson(body);
            if (request == null)
                return new RsWithStatus(new RsText("missing request body"), 400);

            var reqWaypoints = request.waypoints;

            // load infra
            var infra = infraManager.load(request.infra, request.expectedVersion, recorder).java();

            // load rolling stocks
            var rollingStocks = List.<RollingStock>of();
            if (request.rollingStocks != null)
                rollingStocks = request.rollingStocks.stream()
                        .map(RJSRollingStockParser::parse)
                        .toList();

            var path = runPathfinding(infra, reqWaypoints, rollingStocks);

            var res = PathfindingResultConverter.convert(path, infra, recorder);

            validate(infra, res, reqWaypoints);

            return new RsJson(new RsWithBody(PathfindingResult.adapterResult.toJson(res)));
        } catch (Throwable ex) {
            // TODO: include warnings in the response
            return ExceptionHandler.handle(ex);
        }
    }

    /**
     * Runs the pathfinding with the infra and rolling stocks already parsed
     */
    public static Pathfinding.Result<SignalingRoute> runPathfinding(
            SignalingInfra infra,
            PathfindingWaypoint[][] reqWaypoints,
            Collection<RollingStock> rollingStocks
    ) throws NoPathFoundError {
        // parse the waypoints
        var waypoints = new ArrayList<Collection<Pathfinding.EdgeLocation<SignalingRoute>>>();
        for (var step : reqWaypoints) {
            var allStarts = new HashSet<Pathfinding.EdgeLocation<SignalingRoute>>();
            for (var waypoint : step)
                allStarts.addAll(findRoutes(infra, waypoint));
            waypoints.add(allStarts);
        }

        // Initializes the constraints
        var loadingGaugeConstraints = new LoadingGaugeConstraints(rollingStocks);
        var electrificationConstraints = new ElectrificationConstraints(rollingStocks);
        final List<EdgeToRanges<SignalingRoute>> constraintsList =
                List.of(loadingGaugeConstraints, electrificationConstraints);
        var remainingDistanceEstimators = makeHeuristics(waypoints);

        // Compute the paths from the entry waypoint to the exit waypoint
        return computePaths(infra, waypoints, constraintsList, remainingDistanceEstimators);
    }

    /** Initialize the heuristics */
    public static ArrayList<AStarHeuristic<SignalingRoute>> makeHeuristics(
            List<Collection<Pathfinding.EdgeLocation<SignalingRoute>>> waypoints
    ) {
        // Compute the minimum distance between steps
        double[] stepMinDistance = new double[waypoints.size() - 1];
        for (int i = 0; i < waypoints.size() - 2; i++) {
            stepMinDistance[i] = minDistanceBetweenSteps(waypoints.get(i + 1), waypoints.get(i + 2));
        }

        // Reversed cumulative sum
        for (int i = stepMinDistance.length - 2; i >= 0; i--) {
            stepMinDistance[i] += stepMinDistance[i + 1];
        }

        // Setup estimators foreach intermediate steps
        var remainingDistanceEstimators = new ArrayList<AStarHeuristic<SignalingRoute>>();
        for (int i = 0; i < waypoints.size() - 1; i++) {
            remainingDistanceEstimators.add(new RemainingDistanceEstimator(waypoints.get(i + 1), stepMinDistance[i]));
        }
        return remainingDistanceEstimators;
    }


    private static Pathfinding.Result<SignalingRoute> computePaths(
            SignalingInfra infra,
            ArrayList<Collection<Pathfinding.EdgeLocation<SignalingRoute>>> waypoints,
            List<EdgeToRanges<SignalingRoute>> constraintsList,
            List<AStarHeuristic<SignalingRoute>> remainingDistanceEstimators
    ) throws NoPathFoundError {
        var pathFound = new Pathfinding<>(new GraphAdapter<>(infra.getSignalingRouteGraph()))
                .setEdgeToLength(route -> route.getInfraRoute().getLength())
                .setRemainingDistanceEstimator(remainingDistanceEstimators)
                .addBlockedRangeOnEdges(constraintsList)
                .runPathfinding(waypoints);

        if (pathFound != null) {
            return pathFound;
        }
        // check there is no path without adding constraints
        var possiblePathWithoutErrorNoConstraints =
                new Pathfinding<>(new GraphAdapter<>(infra.getSignalingRouteGraph()))
                    .setEdgeToLength(route -> route.getInfraRoute().getLength())
                    .setRemainingDistanceEstimator(remainingDistanceEstimators)
                    .runPathfinding(waypoints);
        if (possiblePathWithoutErrorNoConstraints == null) {
            throw new NoPathFoundError(PATH_FINDING_GENERIC_ERROR);
        }
        // handling errors
        for (EdgeToRanges<SignalingRoute> currentConstraint : constraintsList) {
            var possiblePathWithoutError = new Pathfinding<>(new GraphAdapter<>(infra.getSignalingRouteGraph()))
                    .setEdgeToLength(route -> route.getInfraRoute().getLength())
                    .addBlockedRangeOnEdges(currentConstraint)
                    .setRemainingDistanceEstimator(remainingDistanceEstimators)
                    .runPathfinding(waypoints);
            if (possiblePathWithoutError == null) {
                throw new NoPathFoundError(constraints.get(currentConstraint.getClass()));
            }
        }
        throw new NoPathFoundError(PATH_FINDING_GENERIC_ERROR);
    }

    /**
     * Checks that the results make sense
     */
    private void validate(SignalingInfra infra, PathfindingResult res, PathfindingWaypoint[][] reqWaypoints) {
        var start = res.pathWaypoints.get(0);
        var end = res.pathWaypoints.get(res.pathWaypoints.size() - 1);
        var startLocation = new TrackLocation(infra.getTrackSection(start.track), start.position);
        var endLocation = new TrackLocation(infra.getTrackSection(end.track), end.position);
        var routes = new ArrayList<SignalingRoute>();
        for (var route : res.routePaths) {
            var signalingRoute = infra.findSignalingRoute(route.route, route.signalingType);
            assert signalingRoute != null;
            if (routes.isEmpty() || routes.get(routes.size() - 1) != signalingRoute)
                routes.add(signalingRoute);
        }
        var path = TrainPathBuilder.from(routes, startLocation, endLocation);
        for (int i = 1; i < path.trackRangePath().size(); i++) {
            var prev = path.trackRangePath().get(i - 1).element().track.getEdge();
            var next = path.trackRangePath().get(i).element().track.getEdge();
            assert prev == next || infra.getTrackGraph().adjacentEdges(prev).contains(next)
                    : "The path goes over consecutive tracks that are not adjacent";
        }

        // Checks that at least one waypoint of each step is on the path
        var tracksOnPath = res.routePaths.stream()
                .flatMap(route -> route.trackSections.stream())
                .map(track -> track.trackSection)
                .collect(Collectors.toSet());
        for (var step : reqWaypoints) {
            assert Arrays.stream(step)
                    .anyMatch(waypoint -> tracksOnPath.contains(waypoint.trackSection));
        }
    }

    /**
     * Returns all the EdgeLocations matching the given waypoint
     */
    public static Set<Pathfinding.EdgeLocation<SignalingRoute>> findRoutes(
            SignalingInfra infra,
            PathfindingWaypoint waypoint
    ) {
        var res = new HashSet<Pathfinding.EdgeLocation<SignalingRoute>>();
        var edge = infra.getEdge(waypoint.trackSection, Direction.fromEdgeDir(waypoint.direction));
        if (edge == null)
            throw new InvalidSchedule(
                    String.format("Track %s referenced in path step does not exist", waypoint.trackSection)
            );
        for (var entry : infra.getRoutesOnEdges().get(edge)) {
            var signalingRoutes = infra.getRouteMap().get(entry.route());
            for (var signalingRoute : signalingRoutes) {
                var waypointOffsetFromStart = waypoint.offset;
                if (waypoint.direction.equals(EdgeDirection.STOP_TO_START))
                    waypointOffsetFromStart = edge.getEdge().getLength() - waypoint.offset;
                var offset = waypointOffsetFromStart - entry.startOffset();
                if (offset >= 0 && offset <= signalingRoute.getInfraRoute().getLength())
                    res.add(new Pathfinding.EdgeLocation<>(signalingRoute, offset));
            }
        }
        return res;
    }
}
