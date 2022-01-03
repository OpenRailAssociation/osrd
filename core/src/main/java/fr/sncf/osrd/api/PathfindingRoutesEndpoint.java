package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.api.InfraManager.InfraLoadException;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.routegraph.RouteLocation;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSRoute;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.utils.PointValue;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.graph.Dijkstra;
import fr.sncf.osrd.utils.graph.DistCostFunction;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.path.BasicPathNode;
import fr.sncf.osrd.utils.graph.path.FullPathArray;
import org.takes.Request;
import org.takes.Response;
import org.takes.rq.RqPrint;
import org.takes.rs.RsJson;
import org.takes.rs.RsText;
import org.takes.rs.RsWithBody;
import org.takes.rs.RsWithStatus;
import java.io.IOException;
import java.util.*;

public class PathfindingRoutesEndpoint extends PathfindingEndpoint {
    public static final JsonAdapter<PathfindingResult> adapterResult = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .build()
            .adapter(PathfindingResult.class)
            .failOnUnknown();


    public PathfindingRoutesEndpoint(InfraManager infraHandler) {
        super(infraHandler);
    }

    private int tryFindPath(Infra infra,
                            PriorityQueue<BasicPathNode<Route>> candidatePaths,
                            DistCostFunction<Route> costFunction, ArrayList<RouteLocation> destinationWaypoints,
                            boolean isLastStep,
                            ArrayList<BasicPathNode<Route>> pathsToStep) {
        return Dijkstra.findPaths(
                infra.routeGraph,
                candidatePaths,
                costFunction,
                (pathNode) -> {
                    for (var goalEdge : destinationWaypoints) {
                        if (goalEdge.route != pathNode.edge || goalEdge.offset < pathNode.position)
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
                (pathNode) -> {
                    // If we already found a path, limit the exploration to twice the current length
                    if (pathsToStep.isEmpty())
                        return false;
                    return pathNode.cost > pathsToStep.get(0).cost * 2;
                },
                (pathToGoal) -> {
                    pathsToStep.add(pathToGoal);
                    return !isLastStep;
                });
    }

    @Override
    @SuppressWarnings({"unchecked", "rawtypes"})
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public Response act(Request req) throws IOException {
        try {
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
                    if (edge.forwardRoutes.root == null && edge.backwardRoutes.root == null)
                        return new RsWithStatus(new RsText(
                                String.format("Path location %d is placed on a track section that has no route (%s)",
                                        i, edge.id)
                        ), 400);
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

            var pathsToGoal = new ArrayList<ArrayList<BasicPathNode<Route>>>();

            // Compute the paths from the entry waypoint to the exit waypoint
            for (int i = 1; i < waypoints.length; i++) {
                var destinationWaypoints = waypoints[i];
                var pathsToStep = new ArrayList<BasicPathNode<Route>>();
                var isLastStep = i == waypoints.length - 1;

                var found = tryFindPath(infra, candidatePaths, costFunction,
                        destinationWaypoints, isLastStep, pathsToStep);

                if (found == 0) {
                    // If we can find a path from the start to the next point, it means the intermediate
                    // steps were most likely in the wrong order
                    candidatePaths.clear();
                    for (var startWaypoint : waypoints[0])
                        candidatePaths.add(new BasicPathNode<>(startWaypoint.route, startWaypoint.offset));
                    var isValidPath = tryFindPath(infra, candidatePaths, costFunction,
                            destinationWaypoints, isLastStep, pathsToStep) > 0;

                    var error = String.format(
                            "No path could be found between steps %d and %d",
                            i - 1, i
                    );
                    if (isValidPath)
                        error += " (intermediate steps are likely in the wrong order)";
                    return new RsWithStatus(new RsText(error), 400);
                }

                pathsToGoal.add(pathsToStep);

                // Clear the list of candidates and fill it with the new ones
                candidatePaths.clear();
                for (var nodeStep : pathsToStep)
                    candidatePaths.add(new BasicPathNode<>(nodeStep.edge, nodeStep.position));
            }

            var finalPathsToGoal = filterPathSteps(pathsToGoal);

            var res = new PathfindingResult();
            for (var path : finalPathsToGoal) {
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
        } catch (Throwable ex) {
            ex.printStackTrace(System.err);
            throw ex;
        }
    }

    /** This function select for each step the path to use. To do so we start from the end (since there is only
     *  one path). Then we take paths following the chain.
     */
    @SuppressFBWarnings(value = "FE_FLOATING_POINT_EQUALITY", justification = "No operation is done after the copy")
    private ArrayDeque<FullPathArray<Route, BasicPathNode<Route>>> filterPathSteps(
            ArrayList<ArrayList<BasicPathNode<Route>>> pathsToGoal
    ) {
        var res = new ArrayDeque<FullPathArray<Route, BasicPathNode<Route>>>();

        // There should be only one path for the last step
        var lastPathsToGoal = pathsToGoal.get(pathsToGoal.size() - 1);
        assert lastPathsToGoal.size() == 1;
        var currentStepPath = FullPathArray.from(lastPathsToGoal.get(0));
        res.addFirst(currentStepPath);
        for (int i = pathsToGoal.size() - 2; i >= 0; i--) {
            for (var candidate : pathsToGoal.get(i)) {
                if (candidate.edge == currentStepPath.start.edge
                        && candidate.position == currentStepPath.start.position) {
                    currentStepPath = FullPathArray.from(candidate);
                    res.addFirst(currentStepPath);
                    break;
                }
            }
            assert res.size() == pathsToGoal.size() - i;
        }
        return res;
    }

    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    private RouteLocation pathNodeToRouteLocation(BasicPathNode<Route> node) {
        return new RouteLocation(node.edge, node.position);
    }

    @SuppressFBWarnings({"URF_UNREAD_FIELD", "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static class PathfindingResult {
        public final List<PathStepResult> path;
        public final List<StepResult> steps;

        private PathfindingResult() {
            path = new ArrayList<>();
            steps = new ArrayList<>();
        }

        void add(Route route, List<TrackSectionRange> trackSections) {
            var routeResult = new PathStepResult();
            routeResult.route = new RJSObjectRef<>(route.id, "Route");
            routeResult.trackSections = new ArrayList<>();
            for (var trackSection : trackSections) {
                if (trackSection.direction == EdgeDirection.START_TO_STOP)
                    assert trackSection.getBeginPosition() <= trackSection.getEndPosition();
                else
                    assert trackSection.getBeginPosition() >= trackSection.getEndPosition();
                var trackSectionResult = new DirectionalTrackRangeResult(trackSection.edge.id,
                        trackSection.getBeginPosition(),
                        trackSection.getEndPosition());
                routeResult.trackSections.add(trackSectionResult);
                var opIterator = trackSection.edge.operationalPoints.iterate(
                        trackSection.direction,
                        trackSection.getBeginPosition(),
                        trackSection.getEndPosition(),
                        null);
                while (opIterator.hasNext())
                    addStep(new StepResult(opIterator.next(), trackSection.edge));
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

        public static class PathStepResult {
            public RJSObjectRef<RJSRoute> route;
            @Json(name = "track_sections")
            public List<DirectionalTrackRangeResult> trackSections;
        }

        public static class StepResult {
            public String id;
            public boolean suggestion;
            public RJSObjectRef<RJSTrackSection> track;
            public double position;

            /** Suggested operational points */
            StepResult(PointValue<OperationalPoint> op, TrackSection trackSection) {
                this.id = op.value.id;
                this.suggestion = true;
                this.track = new RJSObjectRef<>(trackSection.id, "TrackSection");
                this.position = op.position;
            }

            /** Given step */
            StepResult(TrackSection trackSection, double position) {
                this.suggestion = false;
                this.track = new RJSObjectRef<>(trackSection.id, "TrackSection");
                this.position = position;
            }

            /** Check if two step result are at the same location */
            public boolean isDuplicate(StepResult other) {
                if (!track.equals(other.track))
                    return false;
                return Math.abs(position - other.position) < 0.001;
            }

            /** Merge a suggested with a give step */
            public void merge(StepResult other) {
                suggestion &= other.suggestion;
                if (!other.suggestion)
                    return;
                position = other.position;
                id = other.id;
            }
        }
    }
}