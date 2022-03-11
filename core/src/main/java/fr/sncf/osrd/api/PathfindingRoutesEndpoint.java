package fr.sncf.osrd.api;

import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.routegraph.RouteLocation;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.utils.geom.LineString;
import fr.sncf.osrd.utils.geom.Point;
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
import java.util.*;

public class PathfindingRoutesEndpoint extends PathfindingEndpoint {
    public static final JsonAdapter<PathfindingResult> adapterResult = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(new LineString.Adapter())
            .add(new Point.Adapter())
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
    @SuppressWarnings({"rawtypes", "unchecked"})
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public Response act(Request req) throws InvalidInfraException {
        try {
            var body = new RqPrint(req).printBody();
            var request = adapterRequest.fromJson(body);
            if (request == null)
                return new RsWithStatus(new RsText("missing request body"), 400);
            if (request.version < 0)
                return new RsWithStatus(new RsText("missing infra version"), 400);

            var reqWaypoints = request.waypoints;

            // load infra
            var infra = infraManager.load(request.infra, request.version);

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

            var res = PathfindingResult.make(finalPathsToGoal, infra);

            return new RsJson(new RsWithBody(adapterResult.toJson(res)));
        } catch (Throwable ex) {
            return ExceptionHandler.handle(ex);
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
}
