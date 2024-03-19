package fr.sncf.osrd.graph

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings
import fr.sncf.osrd.api.pathfinding.constraints.ConstraintCombiner
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.time.Duration
import java.time.Instant
import java.util.*
import java.util.stream.Collectors

@SuppressFBWarnings(
    value = ["FE_FLOATING_POINT_EQUALITY"],
    justification = "No arithmetic is done on values where we test for equality, only copies"
)
class Pathfinding<NodeT : Any, EdgeT : Any, OffsetType>(
    private val graph: Graph<NodeT, EdgeT, OffsetType>
) {
    /** Pathfinding step */
    @JvmRecord
    private data class Step<EdgeT, OffsetType>(
        val range: EdgeRange<EdgeT, OffsetType>, // Range covered by this step
        val prev: Step<EdgeT, OffsetType>?, // Previous step (to construct the result)
        val totalDistance: Double, // Total distance from the start
        val weight:
            Double, // Priority queue weight (could be different from totalDistance to allow for A*)
        val nReachedTargets: Int, // How many targets we found by this path
        val targets: List<EdgeLocation<EdgeT, OffsetType>>
    ) : Comparable<Step<EdgeT, OffsetType>> {
        override fun compareTo(other: Step<EdgeT, OffsetType>): Int {
            return if (weight != other.weight) weight.compareTo(other.weight)
            else {
                // If the weights are equal, we prioritize the highest number of reached targets
                other.nReachedTargets - nReachedTargets
            }
        }
    }

    /** Contains all the results of a pathfinding */
    data class Result<EdgeT, OffsetType>(
        val ranges: List<EdgeRange<EdgeT, OffsetType>>, // Full path as edge ranges
        val waypoints: List<EdgeLocation<EdgeT, OffsetType>>
    )

    /** A location on a range, made of edge + offset. Used for the input of the pathfinding */
    data class EdgeLocation<EdgeT, OffsetType>(val edge: EdgeT, val offset: Offset<OffsetType>)

    /**
     * A range, made of edge + start and end offsets on the edge. Used for the output of the
     * pathfinding
     */
    data class EdgeRange<EdgeT, OffsetType>(
        val edge: EdgeT,
        val start: Offset<OffsetType>,
        val end: Offset<OffsetType>
    )

    /** A simple range with no edge attached */
    data class Range<OffsetType>(val start: Offset<OffsetType>, val end: Offset<OffsetType>)

    /** Step priority queue */
    private val queue = PriorityQueue<Step<EdgeT, OffsetType>>()

    /** Function to call to get edge length */
    private var edgeToLength: EdgeToLength<EdgeT, OffsetType>? = null

    /** Function to call to get the blocked ranges on an edge */
    private val blockedRangesOnEdge = ConstraintCombiner<EdgeT, OffsetType>()

    /**
     * Keeps track of visited location. For each visited range, keeps the max number of passed
     * targets at that point
     */
    private val seen = HashMap<EdgeRange<EdgeT, OffsetType>, Int>()

    /**
     * Functions to call to get estimate of the remaining distance. We have a list of function for
     * each step. These functions take the edge and the offset and returns a distance.
     */
    private var estimateRemainingDistance: List<AStarHeuristic<EdgeT, OffsetType>>? = ArrayList()

    /** Function to call to know the cost of the range. */
    private var edgeRangeCost: EdgeRangeCost<EdgeT, OffsetType>? = null

    /**
     * Function to call to know the cost of the path from the departure point to the edge location .
     * Used in STDCM. Either totalDistanceUntilEdgeLocation or edgeRangeCost must be defined.
     */
    private var totalCostUntilEdgeLocation: TotalCostUntilEdgeLocation<EdgeT, OffsetType>? = null

    /** Timeout, in seconds, to avoid infinite loop when no path can be found. */
    private var timeout = TIMEOUT

    /** Sets the functor used to estimate the remaining distance for A* */
    fun setEdgeToLength(
        f: EdgeToLength<EdgeT, OffsetType>?
    ): Pathfinding<NodeT, EdgeT, OffsetType> {
        edgeToLength = f
        return this
    }

    /** Sets functors used to estimate the remaining distance for A* */
    fun setRemainingDistanceEstimator(
        f: List<AStarHeuristic<EdgeT, OffsetType>>?
    ): Pathfinding<NodeT, EdgeT, OffsetType> {
        estimateRemainingDistance = f
        return this
    }

    /** Sets the functor used to estimate the cost for a range */
    fun setEdgeRangeCost(
        f: EdgeRangeCost<EdgeT, OffsetType>?
    ): Pathfinding<NodeT, EdgeT, OffsetType> {
        edgeRangeCost = f
        return this
    }

    /** Sets the functor used to estimate the cost for a range */
    fun setTotalCostUntilEdgeLocation(
        f: TotalCostUntilEdgeLocation<EdgeT, OffsetType>?
    ): Pathfinding<NodeT, EdgeT, OffsetType> {
        totalCostUntilEdgeLocation = f
        return this
    }

    /** Sets the functor used to determine which ranges are blocked on an edge */
    fun addBlockedRangeOnEdges(
        f: EdgeToRanges<EdgeT, OffsetType>
    ): Pathfinding<NodeT, EdgeT, OffsetType> {
        blockedRangesOnEdge.functions.add(f)
        return this
    }

    /** Sets the functor used to determine which ranges are blocked on an edge */
    fun addBlockedRangeOnEdges(
        f: Collection<EdgeToRanges<EdgeT, OffsetType>>
    ): Pathfinding<NodeT, EdgeT, OffsetType> {
        blockedRangesOnEdge.functions.addAll(f)
        return this
    }

    /** Sets the pathfinding's timeout */
    fun setTimeout(timeout: Double?): Pathfinding<NodeT, EdgeT, OffsetType> {
        if (timeout != null) this.timeout = timeout
        return this
    }

    /**
     * Runs the pathfinding, returning a path as a list of (edge, start offset, end offset). Each
     * target is given as a collection of location. It finds the shortest path from start to end,
     * going through at least one location of each every intermediate target in order. It uses
     * Dijkstra algorithm by default, but can be changed to an A* by specifying a function to
     * estimate the remaining distance, using `setRemainingDistanceEstimator`
     */
    fun runPathfinding(
        targets: List<Collection<EdgeLocation<EdgeT, OffsetType>>>
    ): Result<EdgeT, OffsetType>? {
        // We convert the targets of each step into functions, to call the more generic overload of
        // this
        // method below
        val starts = targets[0]
        val targetsOnEdges = ArrayList<TargetsOnEdge<EdgeT, OffsetType>>()
        for (i in 1 until targets.size) {
            targetsOnEdges.add { edge: EdgeT ->
                val res = HashSet<EdgeLocation<EdgeT, OffsetType>>()
                for (target in targets[i]) {
                    if (target.edge == edge) res.add(EdgeLocation(edge, target.offset))
                }
                res
            }
        }
        return runPathfinding(starts, targetsOnEdges)
    }

    /**
     * Runs the pathfinding, returning a path as a list of (edge, start offset, end offset). The
     * targets for each step are defined as functions, which tell for each edge the offsets (if any)
     * of the target locations for the current step. It finds the shortest path from start to end,
     * going through at least one location of each every intermediate target in order. It uses
     * Dijkstra algorithm by default, but can be changed to an A* by specifying a function to
     * estimate the remaining distance, using `setRemainingDistanceEstimator`
     */
    fun runPathfinding(
        starts: Collection<EdgeLocation<EdgeT, OffsetType>>,
        targetsOnEdges: List<TargetsOnEdge<EdgeT, OffsetType>>
    ): Result<EdgeT, OffsetType>? {
        checkParameters()
        for (location in starts) {
            val startRange = EdgeRange(location.edge, location.offset, location.offset)
            registerStep(startRange, null, 0.0, 0, listOf(location))
        }
        val start = Instant.now()
        while (true) {
            if (Duration.between(start, Instant.now()).toSeconds() >= timeout)
                throw OSRDError(ErrorType.PathfindingTimeoutError)
            val step = queue.poll() ?: return null
            val endNode = graph.getEdgeEnd(step.range.edge)
            if (seen.getOrDefault(step.range, -1) >= step.nReachedTargets) {
                continue
            }
            seen[step.range] = step.nReachedTargets
            if (hasReachedEnd(targetsOnEdges.size, step)) return buildResult(step)
            // Check if the next target is reached in this step, only if the step doesn't already
            // reach a
            // step
            var waypointOnRange = false
            if (step.prev == null || step.nReachedTargets == step.prev.nReachedTargets)
                for (target in targetsOnEdges[step.nReachedTargets].apply(step.range.edge)) if (
                    step.range.start <= target.offset
                ) {
                    waypointOnRange = true
                    // Adds a new step precisely on the stop location. This ensures that we don't
                    // ignore the
                    // distance between the start of the edge and the stop location
                    var newRange = EdgeRange(target.edge, step.range.start, target.offset)
                    newRange = filterRange(newRange)!!
                    if (newRange.end != target.offset) {
                        // The target location is blocked by a blocked range, it can't be accessed
                        // from here
                        continue
                    }
                    val stepTargets = ArrayList(step.targets)
                    stepTargets.add(target)
                    registerStep(
                        newRange,
                        step.prev,
                        step.totalDistance,
                        step.nReachedTargets + 1,
                        stepTargets
                    )
                }
            val edgeLength = edgeToLength!!.apply(step.range.edge)
            if (!waypointOnRange && step.range.end == edgeLength) {
                // We reach the end of the edge: we visit neighbors
                val neighbors = graph.getAdjacentEdges(endNode)
                for (edge in neighbors) {
                    registerStep(
                        EdgeRange(edge, Offset(0.meters), edgeToLength!!.apply(edge)),
                        step,
                        step.totalDistance,
                        step.nReachedTargets
                    )
                }
            } else {
                // We don't reach the end of the edge (intermediate target): we add a new step until
                // the end
                val newRange = EdgeRange(step.range.edge, step.range.end, edgeLength)
                registerStep(newRange, step, step.totalDistance, step.nReachedTargets)
            }
        }
    }

    /** Runs the pathfinding, returning a path as a list of edge. */
    fun runPathfindingEdgesOnly(
        targets: List<Collection<EdgeLocation<EdgeT, OffsetType>>>
    ): List<EdgeT>? {
        val res = runPathfinding(targets) ?: return null
        return res.ranges
            .stream()
            .map { step: EdgeRange<EdgeT, OffsetType> -> step.edge }
            .collect(Collectors.toList())
    }

    /** Checks that required parameters are set, sets the optional ones to their default values */
    private fun checkParameters() {
        assert(edgeToLength != null)
        assert(estimateRemainingDistance != null)
        if (totalCostUntilEdgeLocation == null && edgeRangeCost == null)
            edgeRangeCost = EdgeRangeCost { range ->
                (range.end - range.start).millimeters.toDouble()
            }
    }

    /** Returns true if the step has reached the end of the path (last target) */
    private fun hasReachedEnd(nTargets: Int, step: Step<EdgeT, OffsetType>): Boolean {
        return step.nReachedTargets >= nTargets
    }

    /** Builds the result, iterating over the previous steps and merging ranges */
    private fun buildResult(lastStep: Step<EdgeT, OffsetType>): Result<EdgeT, OffsetType> {
        var mutLastStep: Step<EdgeT, OffsetType>? = lastStep
        val orderedSteps = ArrayDeque<Step<EdgeT, OffsetType>>()
        while (mutLastStep != null) {
            orderedSteps.addFirst(mutLastStep)
            mutLastStep = mutLastStep.prev
        }
        val ranges = ArrayList<EdgeRange<EdgeT, OffsetType>>()
        val waypoints = ArrayList<EdgeLocation<EdgeT, OffsetType>>()
        for (step in orderedSteps) {
            val range = step.range
            val lastIndex = ranges.size - 1
            if (ranges.isEmpty() || ranges[lastIndex].edge !== range.edge) {
                // If we start a new edge, add a new range to the result
                ranges.add(range)
            } else {
                // Otherwise, extend the previous range
                val newRange = EdgeRange(range.edge, ranges[lastIndex].start, range.end)
                ranges[lastIndex] = newRange
            }
            waypoints.addAll(step.targets)
        }
        return Result(ranges, waypoints)
    }

    /** Filter the range to keep only the parts that can be reached */
    private fun filterRange(range: EdgeRange<EdgeT, OffsetType>): EdgeRange<EdgeT, OffsetType>? {
        var end = range.end
        for (blockedRange in blockedRangesOnEdge.apply(range.edge)) {
            if (blockedRange.end < range.start) {
                // The blocked range is before the considered range
                continue
            }
            if (blockedRange.start <= range.start) {
                // The start of the range is blocked: we don't visit this range
                return null
            }
            end = Offset.min(end, blockedRange.start)
        }
        return EdgeRange(range.edge, range.start, end)
    }

    /** Registers one step, adding the edge to the queue if not already seen */
    private fun registerStep(
        range: EdgeRange<EdgeT, OffsetType>,
        prev: Step<EdgeT, OffsetType>?,
        prevDistance: Double,
        nPassedTargets: Int,
        targets: List<EdgeLocation<EdgeT, OffsetType>> = listOf()
    ) {
        val filteredRange = filterRange(range) ?: return
        val totalDistance =
            if (totalCostUntilEdgeLocation != null)
                totalCostUntilEdgeLocation!!.apply(
                    EdgeLocation(filteredRange.edge, filteredRange.end)
                )
            else prevDistance + edgeRangeCost!!.apply(filteredRange)
        var distanceLeftEstimation = 0.0
        if (nPassedTargets < estimateRemainingDistance!!.size)
            distanceLeftEstimation =
                estimateRemainingDistance!![nPassedTargets].apply(
                    filteredRange.edge,
                    // TODO: this is inconsistent with above, should probably be end instead
                    filteredRange.start
                )
        queue.add(
            Step(
                filteredRange,
                prev,
                totalDistance,
                totalDistance + distanceLeftEstimation,
                nPassedTargets,
                targets
            )
        )
    }

    companion object {
        const val TIMEOUT = 120.0
    }
}

// Type aliases to avoid repeating `StaticIdx<T>, T` when edge types are static idx
typealias PathfindingId<NodeT, T> = Pathfinding<NodeT, StaticIdx<T>, T>

typealias PathfindingResultId<T> = Pathfinding.Result<StaticIdx<T>, T>

typealias PathfindingEdgeLocationId<T> = Pathfinding.EdgeLocation<StaticIdx<T>, T>

typealias PathfindingEdgeRangeId<T> = Pathfinding.EdgeRange<StaticIdx<T>, T>
