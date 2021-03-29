package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.routegraph.RouteLocation;
import fr.sncf.osrd.railml.routegraph.RMLTVDSectionPath;
import fr.sncf.osrd.utils.TrackSectionDirectedLoc;
import fr.sncf.osrd.utils.TrackSectionLoc;
import fr.sncf.osrd.utils.graph.BiGraphDijkstra;
import fr.sncf.osrd.utils.graph.DistCostFunction;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.path.*;
import org.takes.Request;
import org.takes.Response;
import org.takes.Take;
import org.takes.rs.RsText;
import org.takes.rs.RsWithStatus;

import java.io.IOException;
import java.util.ArrayList;
import java.util.PriorityQueue;

public class PathfindingEndpoint implements Take {
    private static final JsonAdapter<PathfindingRequest> adapter = new Moshi
            .Builder()
            .build()
            .adapter(PathfindingRequest.class)
            .failOnUnknown();

    private final Infra infra;

    public PathfindingEndpoint(Infra infra) {
        this.infra = infra;
    }

    public static final class PathfindingWaypoint {
        @Json(name = "track_section")
        public final String trackSection;
        public final double offset;
        public final EdgeDirection direction;

        /** Creates a pathfinding waypoint */
        public PathfindingWaypoint(String trackSection, double offset, EdgeDirection direction) {
            this.trackSection = trackSection;
            this.offset = offset;
            this.direction = direction;
        }
    }

    public static final class PathfindingRequest {
        /**
         * A list of points the train must to through
         * [[starting_point_a, starting_point_b], [waypoint], [end_a, end_b]]
         */
        public final PathfindingWaypoint[][] waypoints;

        public PathfindingRequest(PathfindingWaypoint[][] waypoints) {
            this.waypoints = waypoints;
        }
    }

    @Override
    public Response act(Request req) throws IOException {
        var buffer = new okio.Buffer();
        buffer.write(req.body().readAllBytes());
        var jsonRequest = adapter.fromJson(buffer);
        if (jsonRequest == null)
            return new RsWithStatus(new RsText("missing request body"), 400);

        var reqWaypoints = jsonRequest.waypoints;

        // parse the waypoints
        @SuppressWarnings({"unchecked", "rawtypes"})
        var waypoints = (ArrayList<RouteLocation>[]) new ArrayList[reqWaypoints.length];
        for (int i = 0; i < waypoints.length; i++) {
            var stopWaypoints = new ArrayList<RouteLocation>();
            for (var stopWaypoint : reqWaypoints[i]) {
                var edge = infra.trackGraph.trackSectionMap.get(stopWaypoint.trackSection);
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
        PriorityQueue<PathNode<Route, BasicPathStart<Route>, BasicPathEnd<Route>>> candidatePaths = BiGraphDijkstra.makePriorityQueue();
        for (var startWaypoint : waypoints[0])
            candidatePaths.add(new BasicPathStart<>(0, startWaypoint.route, EdgeDirection.START_TO_STOP, startWaypoint.offset));


        var pathsToGoal = new ArrayList<PathNode<Route, BasicPathStart<Route>, BasicPathEnd<Route>>>();
        // Compute the paths from the entry waypoint to the exit waypoint
        for (int i = 1; i < waypoints.length; i++) {
            var destinationWaypoints = waypoints[i];

            BiGraphDijkstra.findPaths(
                    infra.routeGraph,
                    candidatePaths,
                    costFunction,
                    (pathNode) -> {
                        for (var goalEdge : destinationWaypoints) {
                            if (goalEdge.route != pathNode.edge)
                                continue;
                            var addedCost = costFunction.evaluate(goalEdge.route, pathNode.position, goalEdge.route.length);
                            return new BasicPathEnd<>(addedCost, goalEdge.route, pathNode.direction, goalEdge.offset, pathNode);
                        }
                        return null;
                    },
                    (pathToGoal) -> {
                        pathsToGoal.add(pathToGoal);
                        return false;
                    });

            candidatePaths.clear();
            candidatePaths.addAll(pathsToGoal);
        }

        return new RsText("ok");
    }
}