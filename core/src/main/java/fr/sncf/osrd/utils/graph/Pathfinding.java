package fr.sncf.osrd.utils.graph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.utils.graph.functional_interfaces.*;
import fr.sncf.osrd.api.pathfinding.constraints.ConstraintCombiner;
import org.jetbrains.annotations.NotNull;
import java.util.*;
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
    private final PriorityQueue<Step<EdgeT>> queue = new PriorityQueue<>();
    /** Function to call to get edge length */
    private EdgeToLength<EdgeT> edgeToLength;
    /** Function to call to get the blocked ranges on an edge */
    private final ConstraintCombiner<EdgeT> blockedRangesOnEdge = new ConstraintCombiner<>();
    /** Input graph */
    private final Graph<NodeT, EdgeT> graph;
    /** Keeps track of visited location. For each visited range, keeps the max number of passed targets at that point */
    private final HashMap<EdgeRange<EdgeT>, Integer> seen = new HashMap<>();
    /** Function to call to get estimate of the remaining distance.
     * The function takes the edge and the offset and returns a distance. */
    private AStarHeuristic<EdgeT> estimateRemainingDistance = null;
    /** Function to call to know the cost of the range. */
    private EdgeRangeCost<EdgeT> edgeRangeCost = null;

    /** Constructor */
    public Pathfinding(Graph<NodeT, EdgeT> graph) {
        this.graph = graph;
    }

    /** Sets the functor used to estimate the remaining distance for A* */
    public Pathfinding<NodeT, EdgeT> setEdgeToLength(EdgeToLength<EdgeT> f) {
        this.edgeToLength = f;
        return this;
    }

    /** Sets the functor used to estimate the remaining distance for A* */
    public Pathfinding<NodeT, EdgeT> setRemainingDistanceEstimator(AStarHeuristic<EdgeT> f) {
        this.estimateRemainingDistance = f;
        return this;
    }

    /** Sets the functor used to estimate the cost for a range */
    public Pathfinding<NodeT, EdgeT> setEdgeRangeCost(EdgeRangeCost<EdgeT> f) {
        this.edgeRangeCost = f;
        return this;
    }

    /** Sets the functor used to determine which ranges are blocked on an edge */
    public Pathfinding<NodeT, EdgeT> addBlockedRangeOnEdges(EdgeToRanges<EdgeT> f) {
        this.blockedRangesOnEdge.functions.add(f);
        return this;
    }

    /** Runs the pathfinding, returning a path as a list of (edge, start offset, end offset).
     * Each target is given as a collection of location.
     * It finds the shortest path from start to end,
     * going through at least one location of each every intermediate target in order.
     * It uses Dijkstra algorithm by default, but can be changed to an A* by
     * specifying a function to estimate the remaining distance, using `setRemainingDistanceEstimator` */
    public Result<EdgeT> runPathfinding(
            List<Collection<EdgeLocation<EdgeT>>> targets
    ) {
        // We convert the targets of each step into functions, to call the more generic overload of this method below
        var starts = targets.get(0);
        var targetsOnEdges = new ArrayList<TargetsOnEdge<EdgeT>>();
        for (int i = 1; i < targets.size(); i++) {
            int finalI = i;
            targetsOnEdges.add(edge -> {
                var res = new HashSet<EdgeLocation<EdgeT>>();
                for (var target : targets.get(finalI)) {
                    if (target.edge.equals(edge))
                        res.add(new EdgeLocation<>(edge, target.offset));
                }
                return res;
            });
        }
        return runPathfinding(starts, targetsOnEdges);
    }


    /** Runs the pathfinding, returning a path as a list of (edge, start offset, end offset).
     * The targets for each step are defined as functions,
     * which tell for each edge the offsets (if any) of the target locations for the current step.
     * It finds the shortest path from start to end,
     * going through at least one location of each every intermediate target in order.
     * It uses Dijkstra algorithm by default, but can be changed to an A* by
     * specifying a function to estimate the remaining distance, using `setRemainingDistanceEstimator` */
    public Result<EdgeT> runPathfinding(
            Collection<EdgeLocation<EdgeT>> starts,
            List<TargetsOnEdge<EdgeT>> targetsOnEdges
    ) {
        checkParameters();
        for (var location : starts) {
            var startRange = new EdgeRange<>(location.edge, location.offset, edgeToLength.apply(location.edge));
            registerStep(startRange, null, 0, 0, List.of(location));
        }
        while (true) {
            var step = queue.poll();
            if (step == null)
                return null;
            final var endNode = graph.getEdgeEnd(step.range.edge);
            if (endNode == null)
                continue;
            if (!(seen.getOrDefault(step.range, -1) < step.nReachedTargets))
                continue;
            seen.put(step.range, step.nReachedTargets);
            if (hasReachedEnd(targetsOnEdges.size(), step))
                return buildResult(step);
            // Check if the next target is reached in this step
            for (var target : targetsOnEdges.get(step.nReachedTargets).apply(step.range.edge))
                if (step.range.start <= target.offset) {
                    // Adds a new step precisely on the stop location. This ensures that we don't ignore the
                    // distance between the start of the edge and the stop location
                    var newRange = new EdgeRange<>(target.edge, step.range.start, target.offset);
                    newRange = filterRange(newRange);
                    assert newRange != null;
                    if (newRange.end != target.offset) {
                        // The target location is blocked by a blocked range, it can't be accessed from here
                        continue;
                    }
                    var stepTargets = new ArrayList<>(step.targets);
                    stepTargets.add(target);
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
                var neighbors = graph.getAdjacentEdges(endNode);
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
    public List<EdgeT> runPathfindingEdgesOnly(
            List<Collection<EdgeLocation<EdgeT>>> targets
    ) {
        var res = runPathfinding(targets);
        if (res == null)
            return null;
        return res.ranges.stream()
                .map(step -> step.edge)
                .collect(Collectors.toList());
    }

    /** Checks that required parameters are set, sets the optional ones to their default values */
    private void checkParameters() {
        assert edgeToLength != null;
        if (estimateRemainingDistance == null)
            estimateRemainingDistance = (x, y) -> 0.;
        if (edgeRangeCost == null)
            edgeRangeCost = (range) -> range.end - range.start;
    }

    /** Returns true if the step has reached the end of the path (last target) */
    private boolean hasReachedEnd(
            int nTargets,
            Step<EdgeT> step
    ) {
        return step.nReachedTargets >= nTargets;
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
        double totalDistance = prevDistance + edgeRangeCost.apply(range);
        double distanceLeftEstimation = estimateRemainingDistance.apply(range.edge, range.start);
        queue.add(new Step<>(
                range,
                prev,
                totalDistance,
                totalDistance + distanceLeftEstimation,
                nPassedTargets,
                targets
        ));
    }
}
