package fr.sncf.osrd.utils.graph;

import com.google.common.graph.ImmutableNetwork;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import org.jetbrains.annotations.NotNull;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@SuppressFBWarnings(
        value = "FE_FLOATING_POINT_EQUALITY",
        justification = "No arithmetic is done on values where we test for equality, only copies"
)
public class Pathfinding<NodeT, EdgeT> {

    /** Pathfinding step */
    private record Step<EdgeT>(
            EdgeRange<EdgeT> range, // Range covered by this step
            Step<EdgeT> prev, // Previous step (to construct the result)
            double totalDistance, // Total distance from the start
            double weight, // Priority queue weight (could be different from totalDistance to allow for A*)
            int nReachedTargets, // How many targets we found by this path
            List<EdgeLocation<EdgeT>> targets // The list of targets found within this step (in order)
    ) implements Comparable<Step<EdgeT>> {
        @Override
        public int compareTo(@NotNull Step<EdgeT> o) {
            if (weight != o.weight)
                return Double.compare(weight, o.weight);
            // If the weights are equal, we prioritize the highest number of reached targets
            return o.nReachedTargets - nReachedTargets;
        }
    }

    /** Contains all the results of a pathfinding */
    public record Result<EdgeT>(
            List<EdgeRange<EdgeT>> ranges, // Full path as edge ranges
            List<EdgeLocation<EdgeT>> waypoints // All the range locations given as input that the path goes through
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

    /** A simple range with no edge attached */
    public record Range(double start, double end){}

    /** Step priority queue */
    private final PriorityQueue<Step<EdgeT>> queue;
    /** Function to call to get edge length */
    private final Function<EdgeT, Double> edgeToLength;
    /** Function to call to get the blocked ranges on an edge */
    private final Function<EdgeT, Collection<Range>> blockedRangesOnEdge;
    /** Input graph */
    private final ImmutableNetwork<NodeT, EdgeT> graph;
    /** Keeps track of visited location. For each visited range, keeps the max number of passed targets at that point */
    private final HashMap<EdgeRange<EdgeT>, Integer> seen = new HashMap<>();

    /** Returns the shortest path from any start edge to any end edge, as a list of edge (containing start and stop) */
    public static <NodeT, EdgeT> List<EdgeT> findEdgePath(
            ImmutableNetwork<NodeT, EdgeT> graph,
            List<Collection<EdgeLocation<EdgeT>>> locations,
            Function<EdgeT, Double> edgeToLength,
            Function<EdgeT, Collection<Range>> blockedRangesOnEdge
    ) {
        return new Pathfinding<>(graph, edgeToLength, blockedRangesOnEdge).runPathfindingEdgesOnly(locations);
    }

    /** Returns the shortest path from any start edge to any end edge, as a list of (edge, start, end) */
    public static <NodeT, EdgeT> Result<EdgeT> findPath(
            ImmutableNetwork<NodeT, EdgeT> graph,
            List<Collection<EdgeLocation<EdgeT>>> locations,
            Function<EdgeT, Double> edgeToLength,
            Function<EdgeT, Collection<Range>> blockedRangesOnEdge
    ) {
        return new Pathfinding<>(graph, edgeToLength, blockedRangesOnEdge).runPathfinding(locations);
    }

    /** Constructor */
    private Pathfinding(
            ImmutableNetwork<NodeT, EdgeT> graph,
            Function<EdgeT, Double> edgeToLength,
            Function<EdgeT, Collection<Range>> blockedRangesOnEdge
    ) {
        if (blockedRangesOnEdge == null)
            blockedRangesOnEdge = x -> List.of();
        this.blockedRangesOnEdge = blockedRangesOnEdge;
        queue = new PriorityQueue<>();
        this.graph = graph;
        this.edgeToLength = edgeToLength;
    }

    /** Runs the pathfinding, returning a path as a list of (edge, start offset, end offset).
     * Each target is given as a collection of location.
     * It finds the shortest path from start to end,
     * going through at least one location of each every intermediate target in order.
     * It uses Dijkstra algorithm internally, but can be changed to an A* with minor changes */
    private Result<EdgeT> runPathfinding(
            List<Collection<EdgeLocation<EdgeT>>> targets
    ) {
        for (var location : targets.get(0)) {
            var startRange = new EdgeRange<>(location.edge, location.offset, edgeToLength.apply(location.edge));
            registerStep(startRange, null, 0, 0, List.of(location));
        }
        while (true) {
            var step = queue.poll();
            if (step == null)
                return null;
            if (hasReachedEnd(targets, step))
                return buildResult(step);
            // Check if the next target is reached in this step
            for (var targetLocation : targets.get(step.nReachedTargets + 1))
                if (step.range.edge.equals(targetLocation.edge) && step.range.start <= targetLocation.offset) {
                    // Adds a new step precisely on the stop location. This ensures that we don't ignore the
                    // distance between the start of the edge and the stop location
                    var newRange = new EdgeRange<>(targetLocation.edge, step.range.start, targetLocation.offset);
                    newRange = filterRange(newRange);
                    assert newRange != null;
                    if (newRange.end != targetLocation.offset) {
                        // The target location is blocked by a blocked range, it can't be accessed from here
                        continue;
                    }
                    var stepTargets = new ArrayList<>(step.targets);
                    stepTargets.add(targetLocation);
                    registerStep(
                            newRange,
                            step.prev,
                            step.totalDistance,
                            step.nReachedTargets + 1,
                            stepTargets
                    );
                }
            var edgeLength = edgeToLength.apply(step.range.edge);
            if (step.range.end == edgeLength) {
                // We reach the end of the edge: we visit neighbors
                var lastNode = graph.incidentNodes(step.range.edge).nodeV();
                var neighbors = graph.outEdges(lastNode);
                for (var edge : neighbors) {
                    registerStep(
                            new EdgeRange<>(edge, 0, edgeToLength.apply(edge)),
                            step,
                            step.totalDistance,
                            step.nReachedTargets
                    );
                }
            } else {
                // We don't reach the end of the edge (intermediate target): we add a new step until the end
                var newRange = new EdgeRange<>(step.range.edge, step.range.end, edgeLength);
                registerStep(newRange, step, step.totalDistance, step.nReachedTargets);
            }
        }
    }

    /** Runs the pathfinding, returning a path as a list of edge. */
    private List<EdgeT> runPathfindingEdgesOnly(
            List<Collection<EdgeLocation<EdgeT>>> targets
    ) {
        var res = runPathfinding(targets);
        if (res == null)
            return null;
        return res.ranges.stream()
                .map(step -> step.edge)
                .collect(Collectors.toList());
    }

    /** Returns true if the step has reached the end of the path (last target) */
    private boolean hasReachedEnd(
            List<Collection<EdgeLocation<EdgeT>>> targets,
            Step<EdgeT> step
    ) {
        return step.nReachedTargets >= targets.size() - 1;
    }

    /** Builds the result, iterating over the previous steps and merging ranges */
    private Result<EdgeT> buildResult(Step<EdgeT> lastStep) {
        var orderedSteps = new ArrayDeque<Step<EdgeT>>();
        while (lastStep != null) {
            orderedSteps.addFirst(lastStep);
            lastStep = lastStep.prev;
        }
        var ranges = new ArrayList<EdgeRange<EdgeT>>();
        var waypoints = new ArrayList<EdgeLocation<EdgeT>>();
        for (var step : orderedSteps) {
            var lastIndex = ranges.size() - 1;
            if (ranges.isEmpty() || ranges.get(lastIndex).edge != step.range.edge) {
                // If we start a new edge, add a new range to the result
                ranges.add(step.range);
            } else {
                // Otherwise, extend the previous range
                var newRange = new EdgeRange<>(step.range.edge, ranges.get(lastIndex).start, step.range.end);
                ranges.set(lastIndex, newRange);
            }
            waypoints.addAll(step.targets);
        }
        return new Result<>(ranges, waypoints);
    }

    /** Filter the range to keep only the parts that can be reached */
    private EdgeRange<EdgeT> filterRange(EdgeRange<EdgeT> range) {
        var end = range.end;
        for (var blockedRange : blockedRangesOnEdge.apply(range.edge)) {
            if (blockedRange.end < range.start) {
                // The blocked range is before the considered range
                continue;
            }
            if (blockedRange.start <= range.start) {
                // The start of the range is blocked: we don't visit this range
                return null;
            }
            end = Math.min(end, blockedRange.start);
        }
        return new EdgeRange<>(range.edge, range.start, end);
    }

    /** Registers one step, adding the edge to the queue if not already seen */
    private void registerStep(
            EdgeRange<EdgeT> range,
            Step<EdgeT> prev,
            double prevDistance,
            int nPassedTargets
    ) {
        registerStep(range, prev, prevDistance, nPassedTargets, List.of());
    }

    /** Registers one step, adding the edge to the queue if not already seen */
    private void registerStep(
            EdgeRange<EdgeT> range,
            Step<EdgeT> prev,
            double prevDistance,
            int nPassedTargets,
            List<EdgeLocation<EdgeT>> targets
    ) {
        range = filterRange(range);
        if (range == null)
            return;
        if (!(seen.getOrDefault(range, -1) < nPassedTargets))
            return;
        double totalDistance = prevDistance + (range.end - range.start);
        double distanceLeftEstimation = 0; // Set this with geo coordinates if we want an A*
        queue.add(new Step<>(
                range,
                prev,
                totalDistance,
                totalDistance + distanceLeftEstimation,
                nPassedTargets,
                targets
        ));
        seen.put(range, nPassedTargets);
    }
}
