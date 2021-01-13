package fr.sncf.osrd.pathfinding;

import fr.sncf.osrd.infra.graph.AbstractEdge;
import fr.sncf.osrd.infra.graph.AbstractNode;
import fr.sncf.osrd.infra.graph.EdgeDirection;
import fr.sncf.osrd.infra.graph.Graph;
import fr.sncf.osrd.util.Pair;
import fr.sncf.osrd.util.Tuple;

import java.util.*;
import java.util.function.BiConsumer;

public class Dijkstra {
    public static class CandidatePath {
        public final double cost;
        public final int nodeIndex;
        public final boolean reachesGoal;

        CandidatePath(double cost, int nodeIndex, boolean reachesGoal) {
            this.cost = cost;
            this.nodeIndex = nodeIndex;
            this.reachesGoal = reachesGoal;
        }
    }

    /**
     * Compute the shortest path from start to goal
     * @param graph the graph in which to compute the path
     * @param start the starting edge
     * @param startPosition the position on the starting edge
     * @param goal the goal edge
     * @param goalPosition the position on the goal edge
     * @param costFunction the cost function
     * @param pathConsumer the callback to consume the path
     */
    public static <NodeT extends AbstractNode<?>, EdgeT extends AbstractEdge<?>> void findPath(
            Graph<NodeT, EdgeT> graph,
            EdgeT start,
            double startPosition,
            EdgeT goal,
            double goalPosition,
            CostFunction<EdgeT> costFunction,
            BiConsumer<EdgeT, EdgeDirection> pathConsumer
    ) {
        assert startPosition >= 0 && startPosition <= start.length;
        assert goalPosition >= 0 && goalPosition <= goal.length;

        var queue = new PriorityQueue<CandidatePath>(Comparator.comparing(pair -> pair.cost));

        double costToStartNode = costFunction.apply(start, startPosition, 0);
        queue.add(new CandidatePath(costToStartNode, start.startNode, false));
        double costToEndNode = costFunction.apply(start, startPosition, start.length);
        queue.add(new CandidatePath(costToEndNode, start.endNode, false));

        var explored = new HashSet<Integer>();
        var previousNode = new HashMap<Integer, Tuple<Integer, Integer, EdgeDirection>>();
        while (!queue.isEmpty()) {
            var costAndNodeIndex = queue.poll();
            double cost = costAndNodeIndex.cost;
            int nodeIndex = costAndNodeIndex.nodeIndex;
            if (costAndNodeIndex.reachesGoal) {
                deducePath(graph, previousNode, start, goal, nodeIndex, pathConsumer);
                return; // we found the goal
            }
            explored.add(nodeIndex);

            for (var edge : graph.neighbors.get(graph.nodes.get(nodeIndex))) {
                int nextNodeIndex;
                double newCost;
                double length = edge.length;
                EdgeDirection direction;

                if (edge == goal)
                    length = goalPosition;

                if (edge.startNode == nodeIndex) {
                    nextNodeIndex = edge.endNode;
                    newCost = cost + costFunction.apply(edge, 0, length);
                    direction = EdgeDirection.START_TO_STOP;
                } else {
                    assert edge.endNode == nodeIndex;
                    nextNodeIndex = edge.startNode;
                    newCost = cost + costFunction.apply(edge, length, 0);
                    direction = EdgeDirection.STOP_TO_START;
                }

                if (edge == goal) {
                    queue.add(new CandidatePath(newCost, nodeIndex, true));
                    continue;
                }

                if (explored.contains(nextNodeIndex))
                    continue;
                queue.add(new CandidatePath(newCost, nextNodeIndex, false));
                previousNode.put(nextNodeIndex, new Tuple<>(nodeIndex, edge.getIndex(), direction));
            }
        }
        throw new RuntimeException("couldn't find a path");
    }

    private static <NodeT extends AbstractNode<?>, EdgeT extends AbstractEdge<?>> void deducePath(
            Graph<NodeT, EdgeT> graph,
            HashMap<Integer, Tuple<Integer, Integer, EdgeDirection>> previousNode,
            EdgeT start,
            EdgeT goal,
            int goalNodeIndex,
            BiConsumer<EdgeT, EdgeDirection> pathConsumer
    ) {
        var edges = new ArrayList<Pair<Integer, EdgeDirection>>();
        EdgeDirection goalDirection = EdgeDirection.START_TO_STOP;
        if (goal.endNode == goalNodeIndex)
            goalDirection = EdgeDirection.STOP_TO_START;
        var current = new Tuple<>(goalNodeIndex, goal.getIndex(), goalDirection);
        while (current.first != start.startNode && current.first != start.endNode) {
            edges.add(new Pair<>(current.second, current.third));
            current = previousNode.get(current.first);
        }
        edges.add(new Pair<>(current.second, current.third));

        // TODO: find a better algorithm, which does not require this hacky condition
        if (start != goal) {
            // add the start node
            EdgeDirection startDirection = EdgeDirection.START_TO_STOP;
            if (start.endNode == current.first)
                startDirection = EdgeDirection.STOP_TO_START;
            edges.add(new Pair<>(start.getIndex(), startDirection));
        }

        var iterator = edges.listIterator(edges.size());
        while (iterator.hasPrevious()) {
            var pathElem = iterator.previous();
            pathConsumer.accept(graph.edges.get(pathElem.first), pathElem.second);
        }
    }
}
