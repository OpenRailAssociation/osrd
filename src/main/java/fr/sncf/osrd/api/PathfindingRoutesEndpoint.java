package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.api.InfraManager.InfraLoadException;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.routegraph.RouteLocation;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.utils.PointValue;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.graph.Dijkstra;
import fr.sncf.osrd.utils.graph.DistCostFunction;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.path.BasicPathNode;
import fr.sncf.osrd.utils.graph.path.FullPathArray;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.takes.Request;
import org.takes.Response;
import org.takes.rq.RqPrint;
import org.takes.rs.RsJson;
import org.takes.rs.RsText;
import org.takes.rs.RsWithBody;
import org.takes.rs.RsWithStatus;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class PathfindingRoutesEndpoint extends PathfindingEndpoint {
    static final Logger logger = LoggerFactory.getLogger(PathfindingRoutesEndpoint.class);

    public static final JsonAdapter<PathfindingResult> adapterResult = new Moshi
            .Builder()
            .build()
            .adapter(PathfindingResult.class)
            .failOnUnknown();


    public PathfindingRoutesEndpoint(InfraManager infraHandler) {
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
            infra = infraManager.load(request.infra);
        } catch (InfraLoadException | InterruptedException e) {
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
                return new RsWithStatus(new RsText("No path could be found"), 400);

            candidatePaths.clear();
            var lastStop = pathsToGoal.get(pathsToGoal.size() - 1);
            var newCandidate = new BasicPathNode<>(lastStop.edge, lastStop.position);
            candidatePaths.add(newCandidate);
        }

        var res = new PathfindingResult();

        for (var routeBasicPathNode : pathsToGoal) {
            var path = FullPathArray.from(routeBasicPathNode);

            var routeBeginLoc = pathNodeToRouteLocation(path.pathNodes.get(0));
            var beginLoc = routeBeginLoc.getTrackSectionLocation();
            var routeEndLoc = pathNodeToRouteLocation(path.pathNodes.get(path.pathNodes.size() - 1));
            var endLoc = routeEndLoc.getTrackSectionLocation();

            var routes = new ArrayList<Route>();
            for (var node : path.pathNodes) {
                if (routes.isEmpty() || routes.get(routes.size() - 1) != node.edge)
                    routes.add(node.edge);
            }

            for (int j = 0; j < routes.size(); j++) {
                TrackSectionLocation begin = null;
                TrackSectionLocation end = null;
                if (j == 0)
                    begin = beginLoc;
                if (j == routes.size() - 1)
                    end = endLoc;
                var route = routes.get(j);
                var trackSections = Route.routesToTrackSectionRange(
                        Collections.singletonList(route), begin, end);
                if (j == 0) {
                    // Add the given origin location to the steps output
                    var firstTrack = trackSections.get(0);
                    var newStep = new PathfindingResult.StepResult(firstTrack.edge, firstTrack.getBeginPosition());
                    res.addStep(newStep);
                }
                res.add(route, trackSections);
                if (j == routes.size() - 1) {
                    // Add the given destination location to the steps output
                    var lastTrack = trackSections.get(trackSections.size() - 1);
                    var newStep = new PathfindingResult.StepResult(lastTrack.edge, lastTrack.getEndPosition());
                    res.addStep(newStep);
                }
            }
        }
        return new RsJson(new RsWithBody(adapterResult.toJson(res)));
    }

    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    private RouteLocation pathNodeToRouteLocation(BasicPathNode<Route> node) {
        return new RouteLocation(node.edge, node.position);
    }

    @SuppressFBWarnings({"URF_UNREAD_FIELD", "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static class PathfindingResult {
        public final List<RouteResult> path;
        public final List<StepResult> steps;

        private PathfindingResult() {
            path = new ArrayList<>();
            steps = new ArrayList<>();
        }

        void add(Route route, List<TrackSectionRange> trackSections) {
            var routeResult = new RouteResult();
            routeResult.route = route.id;
            routeResult.trackSections = new ArrayList<>();
            for (var trackSection : trackSections) {
                var trackSectionResult = new TrackSectionRangeResult(trackSection.edge.id,
                        trackSection.getBeginPosition(),
                        trackSection.getEndPosition());
                routeResult.trackSections.add(trackSectionResult);
                for (var op : trackSection.edge.operationalPoints) {
                    if (trackSection.containsPosition(op.position)) {
                        var newStep = new StepResult(op, trackSection.edge);
                        addStep(newStep);
                    }
                }
            }
            path.add(routeResult);
        }

        void addStep(StepResult newStep) {
            if (steps.isEmpty()) {
                steps.add(newStep);
                return;
            }
            var lastStep = steps.get(steps.size() - 1);
            if (lastStep.isDuplicate(newStep)) {
                lastStep.merge(newStep);
                return;
            }
            steps.add(newStep);
        }

        public static class RouteResult {
            public String route;
            @Json(name = "track_sections")
            public List<TrackSectionRangeResult> trackSections;
        }

        public static class StepResult {
            public String name;
            public PositionResult position;
            public boolean suggestion;

            /** Suggested operational points */
            StepResult(PointValue<OperationalPoint> op, TrackSection trackSection) {
                this.name = op.value.id;
                this.position = new PositionResult(trackSection.id, op.position);
                this.suggestion = true;
            }

            /** Given step */
            StepResult(TrackSection trackSection, double offset) {
                this.name = "Unknown";
                this.position = new PositionResult(trackSection.id, offset);
                this.suggestion = false;
            }

            /** Check if two step result are at the same location */
            public boolean isDuplicate(StepResult other) {
                if (!position.trackSection.equals(other.position.trackSection))
                    return false;
                return Math.abs(position.offset - other.position.offset) < 0.001;
            }

            /** Merge a suggested with a give step */
            public void merge(StepResult other) {
                suggestion &= other.suggestion;
                if (!other.suggestion)
                    return;
                position = other.position;
                name = other.name;
            }
        }

        public static class PositionResult {
            @Json(name = "track_section")
            public String trackSection;

            public double offset;

            public PositionResult(String trackSection, double offset) {
                this.offset = offset;
                this.trackSection = trackSection;
            }
        }
    }
}