package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.routegraph.RouteLocation;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.utils.graph.Dijkstra;
import fr.sncf.osrd.utils.graph.DistCostFunction;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.path.*;
import org.takes.Request;
import org.takes.Response;
import org.takes.rq.RqPrint;
import org.takes.rs.RsJson;
import org.takes.rs.RsText;
import org.takes.rs.RsWithBody;
import org.takes.rs.RsWithStatus;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class PathfindingRoutesEndpoint extends PathfindingEndpoint {
    public static final JsonAdapter<PathfindingResult[]> adapterResult = new Moshi
            .Builder()
            .build()
            .adapter(PathfindingResult[].class)
            .failOnUnknown();


    public PathfindingRoutesEndpoint(InfraHandler infraHandler) {
        super(infraHandler);
    }

    @Override
    @SuppressWarnings({"unchecked", "rawtypes"})
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public Response act(Request req) throws IOException {
        var body = new RqPrint(req).printBody();
        var request = adapterRequest.fromJson(body);
        if (request == null)
            return new RsWithStatus(new RsText("missing request body"), 400);

        var reqWaypoints = request.waypoints;

        // load infra
        Infra infra;
        try {
            infra = infraHandler.load(request.infra);
        } catch (InvalidInfraException | IOException e) {
            return new RsWithStatus(new RsText(
                    String.format("Error loading infrastructure '%s'%n%s", request.infra, e.getMessage())), 400);
        }

        // parse the waypoints
        var waypoints = (ArrayList<RouteLocation>[]) new ArrayList[reqWaypoints.length];
        for (int i = 0; i < waypoints.length; i++) {
            var stopWaypoints = new ArrayList<RouteLocation>();
            for (var stopWaypoint : reqWaypoints[i]) {
                var edge = infra.trackGraph.trackSectionMap.get(stopWaypoint.trackSection);
                if (edge == null)
                    return new RsWithStatus(new RsText(
                            String.format("Couldn't find track section '%s'", stopWaypoint.trackSection)), 400);
                if (stopWaypoint.offset < 0 || stopWaypoint.offset > edge.length)
                    return new RsWithStatus(new RsText(String.format(
                            "'%f' is an invalid offset for the track section '%s'",
                            stopWaypoint.offset,
                            stopWaypoint.trackSection)),
                            400);
                edge.getRoutes(stopWaypoint.direction).findOverlappingIntervals(
                        routeFragment -> {
                            var trackOffset = stopWaypoint.offset - routeFragment.begin;
                            if (routeFragment.direction == EdgeDirection.STOP_TO_START)
                                trackOffset = routeFragment.end - stopWaypoint.offset;
                            var offset = routeFragment.routeOffset + trackOffset;
                            stopWaypoints.add(new RouteLocation(routeFragment.route, offset));
                        },
                        stopWaypoint.offset,
                        stopWaypoint.offset
                );
            }
            waypoints[i] = stopWaypoints;
        }

        var costFunction = new DistCostFunction<Route>();
        var candidatePaths = Dijkstra.<Route>makePriorityQueue();
        for (var startWaypoint : waypoints[0])
            candidatePaths.add(new BasicPathNode<>(startWaypoint.route, startWaypoint.offset));

        var pathsToGoal = new ArrayList<BasicPathNode<Route>>();

        // Compute the paths from the entry waypoint to the exit waypoint
        for (int i = 1; i < waypoints.length; i++) {
            var destinationWaypoints = waypoints[i];

            var found = Dijkstra.findPaths(
                    infra.routeGraph,
                    candidatePaths,
                    costFunction,
                    (pathNode) -> {
                        for (var goalEdge : destinationWaypoints) {
                            if (goalEdge.route != pathNode.edge)
                                continue;
                            var addedCost = costFunction.evaluate(
                                    goalEdge.route,
                                    pathNode.position,
                                    goalEdge.route.length
                            );
                            return pathNode.end(addedCost, goalEdge.route, goalEdge.offset);
                        }
                        return null;
                    },
                    (pathToGoal) -> {
                        pathsToGoal.add(pathToGoal);
                        return false;
                    });

            if (found == 0)
                return new RsWithStatus(new RsText("Not path could be found"), 400);

            candidatePaths.clear();
            candidatePaths.add(pathsToGoal.get(pathsToGoal.size() - 1));
        }

        var resRoutes = (ArrayList<Route>[]) new ArrayList[reqWaypoints.length - 1];
        var resTrackSections = (ArrayList<TrackSectionRange>[]) new ArrayList[reqWaypoints.length - 1];

        for (int i = 0; i < pathsToGoal.size(); i++) {
            var path = FullPathArray.from(pathsToGoal.get(i));

            var routeBeginLoc = pathNodeToRouteLocation(path.pathNodes.get(0));
            var beginLoc = routeBeginLoc.getTrackSectionLocation();
            var routeEndLoc = pathNodeToRouteLocation(path.pathNodes.get(path.pathNodes.size() - 1));
            var endLoc = routeEndLoc.getTrackSectionLocation();

            var routes = new ArrayList<Route>();
            for (var node : path.pathNodes) {
                if (routes.isEmpty() || routes.get(routes.size() - 1) != node.edge)
                    routes.add(node.edge);
            }

            resRoutes[i] = routes;
            resTrackSections[i] = Route.routesToTrackSectionRange(routes, beginLoc, endLoc);
        }
        var result = new PathfindingResult[resRoutes.length];
        for (int i = 0; i < resRoutes.length; i++)
            result[i] = PathfindingResult.from(resRoutes[i], resTrackSections[i]);
        return new RsJson(new RsWithBody(adapterResult.toJson(result)));
    }

    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    private RouteLocation pathNodeToRouteLocation(BasicPathNode<Route> node) {
        return new RouteLocation(node.edge, node.position);
    }

    @SuppressFBWarnings({"URF_UNREAD_FIELD", "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static class PathfindingResult {
        public final List<String> routes;
        @Json(name = "track_sections")
        public final List<TrackSectionRangeResult> trackSections;

        private PathfindingResult(List<String> routes, List<TrackSectionRangeResult> trackSections) {
            this.routes = routes;
            this.trackSections = trackSections;
        }

        static PathfindingResult from(List<Route> routes, List<TrackSectionRange> trackSections) {
            var resRoutes = new ArrayList<String>();
            var resTrackSections = new ArrayList<TrackSectionRangeResult>();
            for (var route : routes)
                resRoutes.add(route.id);
            for (var track : trackSections)
                resTrackSections.add(new TrackSectionRangeResult(
                        track.edge.id, track.getBeginPosition(), track.getEndPosition()));
            return new PathfindingResult(resRoutes, resTrackSections);
        }
    }
}