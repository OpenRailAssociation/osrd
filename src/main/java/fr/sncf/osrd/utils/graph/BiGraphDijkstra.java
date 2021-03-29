package fr.sncf.osrd.utils.graph;

import static fr.sncf.osrd.utils.graph.EdgeDirection.*;

import fr.sncf.osrd.utils.graph.path.PathEnd;
import fr.sncf.osrd.utils.graph.path.PathNode;
import fr.sncf.osrd.utils.graph.path.PathStart;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

public abstract class BiGraphDijkstra<
        EdgeT extends Edge,
        PathStartT extends PathStart<EdgeT, PathStartT, PathEndT>,
        PathEndT extends PathEnd<EdgeT, PathStartT, PathEndT>
        > {
    static final Logger logger = LoggerFactory.getLogger(BiGraphDijkstra.class);

    public interface GoalChecker<
            EdgeT extends Edge,
            PathStartT extends PathStart<EdgeT, PathStartT, PathEndT>,
            PathEndT extends PathEnd<EdgeT, PathStartT, PathEndT>
            > {
        PathEndT findGoalOnPathEdge(PathNode<EdgeT, PathStartT, PathEndT> node);
    }

    public interface GoalReachedCallback<
            EdgeT extends Edge,
            PathStartT extends PathStart<EdgeT, PathStartT, PathEndT>,
            PathEndT extends PathEnd<EdgeT, PathStartT, PathEndT>
            > {
        boolean onGoalReached(PathEndT pathToGoal);
    }

    public static <
            EdgeT extends Edge,
            PathStartT extends PathStart<EdgeT, PathStartT, PathEndT>,
            PathEndT extends PathEnd<EdgeT, PathStartT, PathEndT>
            > PriorityQueue<PathNode<EdgeT, PathStartT, PathEndT>> makePriorityQueue() {
        return new PriorityQueue<>(
                Comparator.comparing(path -> path.cost));
    }

    public static <
            EdgeT extends Edge,
            PathStartT extends PathStart<EdgeT, PathStartT, PathEndT>,
            PathEndT extends PathEnd<EdgeT, PathStartT, PathEndT>
            > PriorityQueue<PathNode<EdgeT, PathStartT, PathEndT>> makePriorityQueue(
                    Iterable<PathStartT> startingPoints
    ) {
        PriorityQueue<PathNode<EdgeT, PathStartT, PathEndT>> queue = makePriorityQueue();
        for (var startingPoint : startingPoints)
            queue.add(startingPoint);
        return queue;
    }

    /** Compute the shortest path from start to goal */
    @SuppressWarnings("unchecked")
    public static <
            EdgeT extends Edge,
            PathStartT extends PathStart<EdgeT, PathStartT, PathEndT>,
            PathEndT extends PathEnd<EdgeT, PathStartT, PathEndT>
            > int findPaths(
                    BiGraph<EdgeT> graph,
                    PriorityQueue<PathNode<EdgeT, PathStartT, PathEndT>> candidatePaths,
                    CostFunction<EdgeT> costFunction,
                    GoalChecker<EdgeT, PathStartT, PathEndT> goalChecker,
                    GoalReachedCallback<EdgeT, PathStartT, PathEndT> goalReachedCallback
    ) {
        int foundPaths = 0;
        var visitedState = makeVisitedState(graph.getEdgeCount());
        while (!candidatePaths.isEmpty()) {
            // pop the next candidate off the queue, which is the one with the smallest cost
            var currentPath = candidatePaths.poll();

            // if the candidate is an end edge, send it to the caller and stop exploring this branch
            if (currentPath.getType() == PathNode.Type.END) {
                foundPaths++;
                if (goalReachedCallback.onGoalReached((PathEndT) currentPath))
                    continue;
                return foundPaths;
            }

            var currentEdge = currentPath.edge;
            var currentDirection = currentPath.direction;

            // otherwise, check if the end of the current candidate path was visited before.
            // If so, there must be a shorter path to this point, so this path can be discarded
            if (!needsPartialVisit(visitedState, currentEdge.index, currentDirection, currentPath.position))
                continue;

            // otherwise, we have to continue exploring this path
            markAsVisited(visitedState, currentEdge.index, currentDirection, currentPath.position);

            // check if by continuing this path, we find a goal on the last edge of our path
            // if a goal is found, add it to the queue, but don't explore this branch further.
            // we add the path to the queue to ensure the cheapest path to the goal gets found first
            var pathEnd = goalChecker.findGoalOnPathEdge(currentPath);
            if (pathEnd != null) {
                candidatePaths.add(pathEnd);
                continue;
            }

            // if no goal is found on the last edge of the path, continue exploring.
            // the next step is to create a new candidate path for each neighbor at the end of the current path's
            // last edge. each of these new candidate paths ends at the beginning of the neighboring edge.

            // compute the cost of going from the current candidate end point to the end of its edge
            var currentEdgeLastPosition = currentEdge.getLastPosition(currentDirection);
            var addedCost = costFunction.evaluate(currentEdge, currentPath.position, currentEdgeLastPosition);

            // explore all the neighbors of the current candidate, creating new candidate paths
            for (var neighbor : graph.getEndNeighborRels(currentEdge, currentDirection)) {
                var neighborEdge = neighbor.getEdge(currentEdge, currentDirection);
                var neighborDirection = neighbor.getDirection(currentEdge, currentDirection);

                // if the neighbor was already explored from this direction, skip it
                // (this is an optimization, there's a similar check above)
                if (!needsFullVisit(visitedState, neighborEdge.index, neighborEdge.length, neighborDirection))
                    continue;

                var neighborFirstPos = neighborEdge.getFirstPosition(neighborDirection);
                candidatePaths.add(currentPath.chain(addedCost, neighborEdge, neighborDirection, neighborFirstPos));
            }
        }
        return foundPaths;
    }

    // tracking whether some point on an edge was visited is somewhat complicated:
    // edges can be explored from start to stop or from stop to start,
    // and exploration can start right in the middle of the edge.

    // this pair of arrays tracks what open range was explored on direction of each edge:
    // the first array tracks the exploration from START_TO_STOP, and the second one from STOP_TO_START
    //  - either + or - infinity means the edge wasn't explored
    //  - any other value is the point on the edge at which exploration started

    private static double[][] makeVisitedState(int edgeCount) {
        var explored = new double[][] {
                new double[edgeCount],
                new double[edgeCount],
        };

        // initialize the exploration status
        Arrays.fill(explored[START_TO_STOP.id], Double.POSITIVE_INFINITY);
        Arrays.fill(explored[STOP_TO_START.id], Double.NEGATIVE_INFINITY);
        return explored;
    }

    private static boolean needsPartialVisit(
            double[][] visitedState,
            int edgeIndex,
            EdgeDirection direction,
            double startPosition
    ) {
        var dirVisitedState = visitedState[direction.id];
        if (direction == START_TO_STOP)
            return startPosition < dirVisitedState[edgeIndex];
        return startPosition > dirVisitedState[edgeIndex];
    }

    private static boolean needsFullVisit(
            double[][] visitedState,
            int edgeIndex,
            double edgeLength,
            EdgeDirection direction
    ) {
        if (direction == START_TO_STOP)
            return needsPartialVisit(visitedState, edgeIndex, direction, 0);
        return needsPartialVisit(visitedState, edgeIndex, direction, edgeLength);
    }

    private static void markAsVisited(
            double[][] visitedState,
            int edgeIndex,
            EdgeDirection direction,
            double startPosition
    ) {
        var dirVisitedState = visitedState[direction.id];
        dirVisitedState[edgeIndex] = startPosition;
    }
}
