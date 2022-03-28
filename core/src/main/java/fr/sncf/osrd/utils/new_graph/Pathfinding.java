package fr.sncf.osrd.utils.new_graph;

import com.google.common.collect.Lists;
import com.google.common.graph.ImmutableNetwork;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

public class Pathfinding<NodeT, EdgeT> {

    /** Pathfinding step */
    private record Step<EdgeT>(
            EdgeRange<EdgeT> range, // Next step
            Step<EdgeT> prev, // Previous step (to construct the result)
            double totalDistance, // Total distance from the start
            double weight // Priority queue weight (different from distance to allow A*)
    ) {}

    /** A location on a range, made of edge + offset. Used for the input of the pathfinding */
    public record EdgeLocation<EdgeT>(
            EdgeT edge,
            double offset
    ) {}

    /** A range, made of edge + start and end offsets on the edge. Used for the output of the pathfinding */
    public record EdgeRange<EdgeT>(
            EdgeT edge,
            double start,
            double end
    ) {}

    /** Step priority queue */
    private final PriorityQueue<Step<EdgeT>> queue;
    /** Function to get edge length */
    private final Function<EdgeT, Double> edgeToLength;
    /** Input graph */
    private final ImmutableNetwork<NodeT, EdgeT> graph;
    /** Set of visited locations */
    private final HashSet<EdgeRange<EdgeT>> seen = new HashSet<>();

    /** Returns the shortest path from any start edge to any end edge, as a list of edge (containing start and stop) */
    public static <NodeT, EdgeT> List<EdgeT> findEdgePath(
            ImmutableNetwork<NodeT, EdgeT> graph,
            Collection<EdgeLocation<EdgeT>> startLocations,
            Collection<EdgeLocation<EdgeT>> stopLocations,
            Function<EdgeT, Double> edgeToLength
    ) {
        return new Pathfinding<>(graph, edgeToLength).runPathfindingEdgesOnly(startLocations, stopLocations);
    }

    /** Returns the shortest path from any start edge to any end edge, as a list of (edge, start, end) */
    public static <NodeT, EdgeT> List<EdgeRange<EdgeT>> findPath(
            ImmutableNetwork<NodeT, EdgeT> graph,
            Collection<EdgeLocation<EdgeT>> startLocations,
            Collection<EdgeLocation<EdgeT>> stopLocations,
            Function<EdgeT, Double> edgeToLength
    ) {
        return new Pathfinding<>(graph, edgeToLength).runPathfinding(startLocations, stopLocations);
    }

    /** Constructor */
    private Pathfinding(
            ImmutableNetwork<NodeT, EdgeT> graph,
            Function<EdgeT, Double> edgeToLength
    ) {
        var comparator = Comparator.comparingDouble((Step<EdgeT> step) -> step.weight);
        queue = new PriorityQueue<>(comparator);
        this.graph = graph;
        this.edgeToLength = edgeToLength;
    }

    /** Runs the pathfinding, returning a path as a list of (edge, start offset).
     * It uses Dijkstra algorithm internally, but can be changed to an A* with minor changes */
    private List<EdgeRange<EdgeT>> runPathfinding(
            Collection<EdgeLocation<EdgeT>> startLocations,
            Collection<EdgeLocation<EdgeT>> stopLocations
    ) {
        for (var location : startLocations) {
            var startRange = new EdgeRange<>(location.edge, location.offset, edgeToLength.apply(location.edge));
            registerStep(startRange, null, 0);
        }
        while (true) {
            var step = queue.poll();
            if (step == null)
                return null;
            if (hasReachedEnd(stopLocations, step))
                return buildResult(step);
            for (var stopLocation : stopLocations)
                if (step.range.edge.equals(stopLocation.edge) && step.range.start <= stopLocation.offset) {
                    // Adds a last step precisely on the end location. This ensures that we don't ignore the
                    // distance between the start of the edge and the end location
                    var newRange = new EdgeRange<>(stopLocation.edge, step.range.start, stopLocation.offset);
                    registerStep(newRange, step.prev, step.totalDistance);
                }
            var lastNode = graph.incidentNodes(step.range.edge).nodeV();
            var neighbors = graph.outEdges(lastNode);
            for (var edge : neighbors) {
                registerStep(new EdgeRange<>(edge, 0, edgeToLength.apply(edge)), step, step.totalDistance);
            }
        }
    }

    /** Runs the pathfinding, returning a path as a list of edge. */
    private List<EdgeT> runPathfindingEdgesOnly(
            Collection<EdgeLocation<EdgeT>> startLocations,
            Collection<EdgeLocation<EdgeT>> stopLocations
    ) {
        var locatedSteps = runPathfinding(startLocations, stopLocations);
        if (locatedSteps == null)
            return null;
        return locatedSteps.stream()
                .map(step -> step.edge)
                .collect(Collectors.toList());
    }


    /** Returns true if the step matches (exactly) one of the end goals */
    private boolean hasReachedEnd(
            Collection<EdgeLocation<EdgeT>> stopLocations,
            Step<EdgeT> step
    ) {
        for (var stop : stopLocations)
            if (
                    stop.edge.equals(step.range.edge)
                    && stop.offset() == step.range.end()
            )
                return true;
        return false;
    }

    /** Builds the result, iterating over the previous steps */
    private List<EdgeRange<EdgeT>> buildResult(Step<EdgeT> step) {
        var invertedResult = new ArrayList<EdgeRange<EdgeT>>();
        while (step != null) {
            invertedResult.add(step.range);
            step = step.prev;
        }
        return Lists.reverse(invertedResult);
    }

    /** Registers one step, adding the edge to the queue if not already seen */
    private void registerStep(EdgeRange<EdgeT> range, Step<EdgeT> prev, double prevDistance) {
        if (seen.contains(range))
            return;
        double totalDistance = prevDistance + (range.end - range.start);
        var distanceLeftEstimation = 0; // Set this with geo coordinates if we want an A*
        queue.add(new Step<>(range, prev, totalDistance, totalDistance + distanceLeftEstimation));
        seen.add(range);
    }
}
