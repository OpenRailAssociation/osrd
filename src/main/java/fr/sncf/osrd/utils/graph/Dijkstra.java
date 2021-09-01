package fr.sncf.osrd.utils.graph;

import fr.sncf.osrd.utils.graph.path.BasicPathNode;
import fr.sncf.osrd.utils.graph.path.PathNode;

import java.util.Arrays;
import java.util.Comparator;
import java.util.PriorityQueue;

public abstract class Dijkstra {
    public interface GoalChecker<EdgeT extends Edge> {
        BasicPathNode<EdgeT> findGoalOnPathEdge(BasicPathNode<EdgeT> node);
    }

    public interface StopChecker<EdgeT extends Edge> {
        boolean stopResearch(BasicPathNode<EdgeT> node);
    }

    public interface GoalReachedCallback<EdgeT extends Edge> {
        boolean onGoalReached(BasicPathNode<EdgeT> pathToGoal);
    }

    public static <EdgeT extends Edge> PriorityQueue<BasicPathNode<EdgeT>> makePriorityQueue() {
        return new PriorityQueue<>(Comparator.comparing(path -> path.cost));
    }

    /** Create a priority queue from starting points */
    public static <EdgeT extends Edge> PriorityQueue<BasicPathNode<EdgeT>> makePriorityQueue(
            Iterable<BasicPathNode<EdgeT>> startingPoints
    ) {
        PriorityQueue<BasicPathNode<EdgeT>> queue = makePriorityQueue();
        for (var startingPoint : startingPoints)
            queue.add(startingPoint);
        return queue;
    }

    /** Compute the shortest path from start to goal in a bidirectional graph */
    @SuppressWarnings("unchecked")
    public static <EdgeT extends Edge> int findPaths(
            DirGraph<EdgeT> graph,
            PriorityQueue<BasicPathNode<EdgeT>> candidatePaths,
            CostFunction<EdgeT> costFunction,
            GoalChecker<EdgeT> goalChecker,
            StopChecker<EdgeT> stopChecker,
            GoalReachedCallback<EdgeT> goalReachedCallback
    ) {
        int foundPaths = 0;
        var visitedState = makeVisitedState(graph.getEdgeCount());
        while (!candidatePaths.isEmpty()) {
            // pop the next candidate off the queue, which is the one with the smallest cost
            var currentPath = candidatePaths.poll();

            // if the candidate is an end edge, send it to the caller and stop exploring this branch
            if (currentPath.type == PathNode.Type.END) {
                foundPaths++;
                if (goalReachedCallback.onGoalReached(currentPath))
                    continue;
                return foundPaths;
            }

            var currentEdge = currentPath.edge;

            // otherwise, check if the end of the current candidate path was visited before.
            // If so, there must be a shorter path to this point, so this path can be discarded
            if (!needsPartialVisit(visitedState, currentEdge.index, currentPath.position))
                continue;

            // otherwise, we have to continue exploring this path
            markAsVisited(visitedState, currentEdge.index, currentPath.position);

            // check if we have to stop the research
            if (stopChecker.stopResearch(currentPath))
                continue;

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
            var currentEdgeLastPosition = currentEdge.length;
            var addedCost = costFunction.evaluate(currentEdge, currentPath.position, currentEdgeLastPosition);

            // explore all the neighbors of the current candidate, creating new candidate paths
            for (var neighborEdge : graph.getNeighbors(currentEdge)) {
                // if the neighbor was already explored from this direction, skip it
                // (this is an optimization, there's a similar check above)
                if (!needsFullVisit(visitedState, neighborEdge.index))
                    continue;

                candidatePaths.add(currentPath.chain(addedCost, neighborEdge, 0));
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

    private static double[] makeVisitedState(int edgeCount) {
        var explored = new double[edgeCount];

        // initialize the exploration status
        Arrays.fill(explored, Double.POSITIVE_INFINITY);
        return explored;
    }

    private static boolean needsPartialVisit(
            double[] visitedState,
            int edgeIndex,
            double startPosition
    ) {
        return startPosition < visitedState[edgeIndex];
    }

    private static boolean needsFullVisit(
            double[] visitedState,
            int edgeIndex
    ) {
        return needsPartialVisit(visitedState, edgeIndex, 0);
    }

    private static void markAsVisited(
            double[] visitedState,
            int edgeIndex,
            double startPosition
    ) {
        visitedState[edgeIndex] = startPosition;
    }
}
