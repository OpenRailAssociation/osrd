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
        @SuppressWarnings({"unchecked", "rawtypes"})
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
                            trackOffset = edge.position(routeFragment.direction, trackOffset);
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

        @SuppressWarnings({"unchecked", "rawtypes"})
        var resRoutes = (ArrayList<RouteLocation>[]) new ArrayList[reqWaypoints.length - 1];
        @SuppressWarnings({"unchecked", "rawtypes"})
        var resTrackSections = (ArrayList<TrackSectionRange>[]) new ArrayList[reqWaypoints.length - 1];

        for (int i = 0; i < pathsToGoal.size(); i++) {
            var path = FullPathArray.from(pathsToGoal.get(i));
            resRoutes[i] = fullPathToRoutes(path);
            var beginLoc = resRoutes[i].get(0).getTrackSectionLocation();
            var endLoc = resRoutes[i].get(resRoutes[i].size() - 1).getTrackSectionLocation();
            var routes = new ArrayList<Route>();
            for (var routeLoc : resRoutes[i])
                routes.add(routeLoc.route);
            resTrackSections[i] = Route.routesToTrackSectionRange(routes, beginLoc, endLoc);
        }
        var result = new PathfindingResult[resRoutes.length];
        for (int i = 0; i < resRoutes.length; i++)
            result[i] = PathfindingResult.from(resRoutes[i], resTrackSections[i]);
        return new RsJson(new RsWithBody(adapterResult.toJson(result)));
    }

    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    private ArrayList<RouteLocation> fullPathToRoutes(FullPathArray<Route, BasicPathNode<Route>> path) {
        var routes = new ArrayList<RouteLocation>();
        for (var node : path.pathNodes)
            routes.add(new RouteLocation(node.edge, node.position));
        return  routes;
    }

    @SuppressFBWarnings({"URF_UNREAD_FIELD", "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static class PathfindingResult {
        public final List<RouteLocationResult> routes;
        @Json(name = "track_sections")
        public final List<TrackSectionRangeResult> trackSections;

        private PathfindingResult(List<RouteLocationResult> routes, List<TrackSectionRangeResult> trackSections) {
            this.routes = routes;
            this.trackSections = trackSections;
        }

        static PathfindingResult from(List<RouteLocation> routes, List<TrackSectionRange> trackSections) {
            var resRoutes = new ArrayList<RouteLocationResult>();
            var resTrackSections = new ArrayList<TrackSectionRangeResult>();
            for (var route : routes)
                resRoutes.add(new RouteLocationResult(route.route.id, route.offset));
            for (var track : trackSections)
                resTrackSections.add(new TrackSectionRangeResult(
                        track.edge.id, track.getBeginPosition(), track.getEndPosition()));
            return new PathfindingResult(resRoutes, resTrackSections);
        }
    }

    @SuppressFBWarnings({"URF_UNREAD_FIELD"})
    private static class RouteLocationResult {
        private final String route;
        private final double offset;

        private RouteLocationResult(String route, double offset) {
            this.route = route;
            this.offset = offset;
        }
    }
}