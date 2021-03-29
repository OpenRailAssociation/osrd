package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.infra.Infra;
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
        var waypoints = new TrackSectionDirectedLoc[reqWaypoints.length][];
        for (int i = 0; i < waypoints.length; i++) {
            var stopReqWaypoints = reqWaypoints[i];
            var stopWaypoints = new TrackSectionDirectedLoc[stopReqWaypoints.length];
            for (int j = 0; j < stopWaypoints.length; j++) {
                var reqWaypoint = stopReqWaypoints[j];
                var edge = infra.trackGraph.trackSectionMap.get(reqWaypoint.trackSection);
                stopWaypoints[j] = new TrackSectionDirectedLoc(edge, reqWaypoint.offset, reqWaypoint.direction);
            }
            waypoints[i] = stopWaypoints;
        }


        var costFunction = new DistCostFunction<RMLTVDSectionPath>();
        var availablePaths = new ArrayList<
                FullPathArray<RMLTVDSectionPath, BasicPathStart<RMLTVDSectionPath>, BasicPathEnd<RMLTVDSectionPath>>>();

        // Compute the paths from the entry waypoint to the exit waypoint
        var currentPaths = new ArrayList<PathNode<?, ?, ?>>();
        for (int i = 1; i < waypoints.length; i++) {
            var destinationWaypoints = waypoints[i];
            var goalEdges = new TrackSectionLoc[destinationWaypoints.length];

            BiGraphDijkstra.findPaths(
                    infra.routeGraph,
                    currentPaths,
                    costFunction,
                    (pathNode) -> {
                        for (var goalEdge : destinationWaypoints) {
                            if (goalEdge != pathNode.edge)
                                continue;
                            var addedCost = costFunction.evaluate(goalEdge, pathNode.position, goalEdge.length);
                            return new BasicPathEnd<>(addedCost, goalEdge, pathNode.direction, 0, pathNode);
                        }
                        return null;
                    },
                    (pathToGoal) -> {
                        availablePaths.add(FullPathArray.from(pathToGoal));
                        return false;
                    });
        }

        return new RsText("ok");
    }
}