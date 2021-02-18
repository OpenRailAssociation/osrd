package fr.sncf.osrd.pathfinding;

import static fr.sncf.osrd.infra.graph.EdgeDirection.*;

import fr.sncf.osrd.infra.graph.AbstractEdge;
import fr.sncf.osrd.infra.graph.AbstractNode;
import fr.sncf.osrd.infra.graph.EdgeDirection;
import fr.sncf.osrd.infra.graph.Graph;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.util.function.BiConsumer;

public class Dijkstra {
    static final Logger logger = LoggerFactory.getLogger(Dijkstra.class);

    /**
     * A linked list of edges inside a graph.
     * Edges are added at the head of the list.
     * @param <EdgeT> the type of edges
     */
    private static class Path<EdgeT> {
        public final double cost;
        public final EdgeT edge;
        public final EdgeDirection direction;
        public final Path<EdgeT> previous;

        Path(
                double cost,
                EdgeT edge,
                EdgeDirection direction,
                Path<EdgeT> previous
        ) {
            this.cost = cost;
            this.edge = edge;
            this.direction = direction;
            this.previous = previous;
        }

        /**
         * Creates a new path.
         * @param cost the cost of this path embryo
         * @param startingEdge the first edge of the path
         * @param direction the direction the path is headed to
         * @param <EdgeT> the type of the path's edges
         * @return a new path
         */
        static <EdgeT extends AbstractEdge<?, ?>> Path<EdgeT> init(
                double cost,
                EdgeT startingEdge,
                EdgeDirection direction
        ) {
            return new Path<>(cost, startingEdge, direction, null);
        }

        /**
         * Creates a new component at the end of an existing path.
         * @param addedCost the cost added by this path component
         * @param newEdge the edge of the path component
         * @param direction the direction the path is headed to
         * @return a new path
         */
        Path<EdgeT> chain(
                double addedCost,
                EdgeT newEdge,
                EdgeDirection direction
        ) {
            assert addedCost >= 0.;
            return new Path<>(cost + addedCost, newEdge, direction, this);
        }
    }

    /**
     * Compute the shortest path from start to goal
     * @param graph the graph in which to compute the path
     * @param startEdge the starting edge
     * @param startPosition the position on the starting edge
     * @param goalEdge the goal edge
     * @param goalPosition the position on the goal edge
     * @param costFunction the cost function
     * @param pathConsumer the callback to consume the path
     */
    @SuppressWarnings("unchecked")
    public static <NodeT extends AbstractNode, EdgeT extends AbstractEdge<NodeT, EdgeT>> void findPath(
            Graph<NodeT, EdgeT> graph,
            EdgeT startEdge,
            double startPosition,
            EdgeT goalEdge,
            double goalPosition,
            CostFunction<EdgeT> costFunction,
            BiConsumer<EdgeT, EdgeDirection> pathConsumer
    ) {
        logger.trace("pathfinding from {}:{} to {}:{}", startEdge, startPosition, goalEdge, goalPosition);

        assert startPosition >= 0 && startPosition <= startEdge.length;
        assert goalPosition >= 0 && goalPosition <= goalEdge.length;

        // checking this early enables the rest of algorithm
        // to assume the goal was found once the target edge was
        if (startEdge == goalEdge) {
            logger.trace("start and goal are on the same edge");
            var direction = START_TO_STOP;
            if (goalPosition < startPosition)
                direction = STOP_TO_START;
            pathConsumer.accept(startEdge, direction);
            return;
        }

        var queue = new PriorityQueue<Path<EdgeT>>(Comparator.comparing(path -> path.cost));

        // add to the queue the two initial options: either go one way, or the other
        double costToStartNode = costFunction.apply(startEdge, startPosition, 0);
        queue.add(Path.init(costToStartNode, startEdge, STOP_TO_START));
        double costToEndNode = costFunction.apply(startEdge, startPosition, startEdge.length);
        queue.add(Path.init(costToEndNode, startEdge, START_TO_STOP));

        // we don't see the same neighbors depending on the direction we're coming from,
        // so we need two bitsets to track it we visited an edge
        var edgeCount = graph.edges.size();
        var explored = new BitSet[] {
                new BitSet(edgeCount), // START_TO_STOP
                new BitSet(edgeCount)  // STOP_TO_START
        };

        while (!queue.isEmpty()) {
            // pop the next candidate off the queue
            var currentPath = queue.poll();

            logger.trace("considering path ending at {} with cost {}", currentPath.edge, currentPath.cost);

            // if the best candidate reaches the goal, stop searching
            if (currentPath.edge == goalEdge) {
                logger.trace("found goal");
                rebuildPath(currentPath, pathConsumer);
                return;
            }

            var currentEdge = currentPath.edge;
            var currentDirection = currentPath.direction;
            var currentEndNode = currentEdge.getEndNode(currentDirection);

            // mark the node as explored
            explored[currentDirection.id].set(currentEdge.getIndex());

            // explore all the neighbors of the current candidate
            for (var neighborEdge : currentEdge.getEndNeighbors(currentDirection, graph)) {

                // find which direction we're approaching the neighbor edge from
                EdgeDirection direction;
                if (neighborEdge.startNode == currentEndNode)
                    direction = START_TO_STOP;
                else {
                    assert neighborEdge.endNode == currentEndNode;
                    direction = STOP_TO_START;
                }

                // if the neighbor was already explored from this direction, skip it
                if (explored[direction.id].get(neighborEdge.getIndex()))
                    continue;

                // compute the begin and end position of the portion of the neighbor edge the path covers
                // (it's needed to compute the cost)
                double neighborBeginPos;
                double neighborEndPos;
                if (direction == START_TO_STOP) {
                    neighborBeginPos = 0.;
                    neighborEndPos = neighborEdge.length;
                } else {
                    neighborBeginPos = neighborEdge.length;
                    neighborEndPos = 0.;
                }

                // if the neighbor is the goal, the path ends early.
                // we should only take in account the cost between our end of the edge and the goal
                if (neighborEdge == goalEdge)
                    neighborEndPos = goalPosition;

                // compute the added cost of this edge
                var addedCost = costFunction.apply(neighborEdge, neighborBeginPos, neighborEndPos);
                queue.add(currentPath.chain(addedCost, neighborEdge, direction));
            }
        }
        throw new RuntimeException("couldn't find a path");
    }

    private static <EdgeT> void rebuildPath(
            Path<EdgeT> path,
            BiConsumer<EdgeT, EdgeDirection> pathConsumer
    ) {
        // convert the goal to start path linked list to an array, reversing the order in the process
        var pathElements = new ArrayDeque<Path<EdgeT>>();
        for (var cur = path; cur != null; cur = cur.previous)
            pathElements.addFirst(cur);

        for (var pathElement : pathElements)
            pathConsumer.accept(pathElement.edge, pathElement.direction);
    }
}
