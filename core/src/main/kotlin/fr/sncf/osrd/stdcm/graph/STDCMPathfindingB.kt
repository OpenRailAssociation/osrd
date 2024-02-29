package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.pathfinding.constraints.*
import fr.sncf.osrd.api.pathfinding.makeHeuristics
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.graph.*
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.stdcm.STDCMResult
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.stdcm.infra_exploration.initInfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.time.Duration
import java.time.Instant
import java.util.*
import java.util.ArrayDeque
import java.util.stream.Collectors
import kotlin.collections.ArrayList
import kotlin.collections.HashSet

class STDCMPathfindingB<NodeT : Any, EdgeT : Any, OffsetType>(
    val fullInfra: FullInfra,
    val rollingStock: RollingStock,
    val comfort: RollingStock.Comfort?,
    val startTime: Double,
    val steps: List<STDCMStep>,
    val blockAvailability: BlockAvailabilityInterface,
    val timeStep: Double,
    val maxDepartureDelay: Double,
    val maxRunTime: Double,
    val tag: String?,
    val standardAllowance: AllowanceValue?,
    val pathfindingTimeout: Double,
    var graph: STDCMGraph? = null,
) {

    private var edgeToLength: EdgeToLength<STDCMEdge, OffsetType>? = null
    private var totalCostUntilEdgeLocation: TotalCostUntilEdgeLocation<STDCMEdge, OffsetType>? =
        null
    private var estimateRemainingDistance: List<AStarHeuristic<STDCMEdge, STDCMEdge>>? = ArrayList()

    init {
        graph =
            STDCMGraph(
                this.fullInfra,
                rollingStock,
                comfort,
                timeStep,
                blockAvailability,
                maxRunTime,
                startTime,
                steps,
                tag,
                standardAllowance
            )
        edgeToLength = EdgeToLength { edge -> edge.infraExplorer.getCurrentBlockLength().cast() }

        @Suppress("UNCHECKED_CAST")
        totalCostUntilEdgeLocation = TotalCostUntilEdgeLocation { range ->
            computeTotalCostUntilEdgeLocation(
                range as EdgeLocation<STDCMEdge, STDCMEdge>,
                maxDepartureDelay
            )
        }
    }

    fun findPath(): STDCMResult? {
        assert(steps.size >= 2) { "Not enough steps have been set to find a path" }

        // Initialize the A* heuristic
        val locations = steps.stream().map(STDCMStep::locations).toList()
        val remainingDistanceEstimators = makeHeuristics(fullInfra, locations)
        val endBlocks = steps.last().locations.map { it.edge }
        estimateRemainingDistance = makeAStarHeuristic(remainingDistanceEstimators, rollingStock)
        val path =
            Pathfinding(graph!!)
                .setRemainingDistanceEstimator(
                    makeAStarHeuristic(remainingDistanceEstimators, rollingStock)
                )
                .runPathfinding( // à faire
                    convertLocations(
                        graph!!,
                        steps[0].locations,
                        startTime,
                        maxDepartureDelay,
                        rollingStock,
                        endBlocks
                    ),
                    makeObjectiveFunction(steps)
                ) ?: return null
        return STDCMPostProcessing(graph!!)
            .makeResult(
                fullInfra.rawInfra,
                path,
                startTime,
                graph!!.standardAllowance,
                rollingStock,
                timeStep,
                comfort,
                maxRunTime,
                blockAvailability
            )
    }

    /** Converts ranges with block offsets to ranges with STDCMEdge offset */
    fun convertRanges(
        ranges: Collection<Pathfinding.Range<Block>>
    ): Collection<Pathfinding.Range<STDCMEdge>> {
        return ranges.map { range -> Pathfinding.Range(range.start.cast(), range.end.cast()) }
    }

    /** Make the objective function from the edge locations */
    private fun makeObjectiveFunction( // utiliser les STDCMNodes a la place des Edges (on peut
        // recup Nodes depuis Edges et inversement)
        steps: List<STDCMStep>
    ): List<TargetsOnEdge<STDCMEdge, STDCMEdge>> {
        val globalResult = ArrayList<TargetsOnEdge<STDCMEdge, STDCMEdge>>()
        for (i in 1 until steps.size) {
            val step = steps[i]
            globalResult.add { edge ->
                val res = HashSet<EdgeLocation<STDCMEdge, STDCMEdge>>()
                for (loc in step.locations) if (loc.edge == edge.block) {
                    val offsetOnEdge: Offset<STDCMEdge> =
                        loc.offset.cast<STDCMEdge>() - edge.envelopeStartOffset.distance
                    if (offsetOnEdge >= Offset(0.meters) && offsetOnEdge <= edge.length)
                        res.add(EdgeLocation(edge, offsetOnEdge))
                }
                res
            }
        }
        return globalResult
    }

    /**
     * Compute the total cost of a path (in s) to an edge location This estimation of the total cost
     * is used to compare paths in the pathfinding algorithm. We select the shortest path (in
     * duration), and for 2 paths with the same duration, we select the earliest one. The path
     * weight which takes into account the total duration of the path and the time shift at the
     * departure (with different weights): path_duration * searchTimeRange + departure_time_shift.
     *
     * <br></br> EXAMPLE Let's assume we are trying to find a train between 9am and 10am. The
     * searchTimeRange is 1 hour (3600s). Let's assume we have found two possible trains:
     * - the first one leaves at 9:59 and lasts for 20:00 min.
     * - the second one leaves at 9:00 and lasts for 20:01 min. As we are looking for the fastest
     *   train, the first train should have the lightest weight, which is the case with the formula
     *   above.
     */
    private fun computeTotalCostUntilEdgeLocation(
        range: EdgeLocation<STDCMEdge, STDCMEdge>,
        searchTimeRange: Double
    ): Double {
        val envelope = range.edge.envelope
        val timeEnd =
            interpolateTime(
                envelope,
                range.offset,
                range.edge.timeStart,
                range.edge.standardAllowanceSpeedFactor
            )
        val pathDuration = timeEnd - range.edge.totalDepartureTimeShift
        return pathDuration * searchTimeRange + range.edge.totalDepartureTimeShift
    }

    /**
     * Converts the "raw" heuristics based on physical blocks, returning the most optimistic
     * distance, into heuristics based on stdcm edges, returning the most optimistic time
     */
    private fun makeAStarHeuristic(
        baseBlockHeuristics: ArrayList<AStarHeuristicId<Block>>,
        rollingStock: RollingStock
    ): List<AStarHeuristic<STDCMEdge, STDCMEdge>> {
        val res = ArrayList<AStarHeuristic<STDCMEdge, STDCMEdge>>()
        for (baseBlockHeuristic in baseBlockHeuristics) {
            res.add(
                AStarHeuristic { edge, offset ->
                    val distance =
                        baseBlockHeuristic.apply(
                            edge.block,
                            convertOffsetToBlock(offset, edge.envelopeStartOffset)
                        )
                    distance / rollingStock.maxSpeed
                }
            )
        }
        return res
    }

    /** Converts locations on a block id into a location on a STDCMGraph.Edge. */
    private fun convertLocations(
        graph: STDCMGraph,
        locations: Collection<PathfindingEdgeLocationId<Block>>,
        startTime: Double,
        maxDepartureDelay: Double,
        rollingStock: RollingStock,
        endBlocks: Collection<BlockId> = setOf()
    ): Set<EdgeLocation<STDCMEdge, STDCMEdge>> {
        val res = HashSet<EdgeLocation<STDCMEdge, STDCMEdge>>()

        // Initializes the constraints
        val loadingGaugeConstraints =
            LoadingGaugeConstraints(fullInfra.blockInfra, fullInfra.rawInfra, listOf(rollingStock))

        val electrificationConstraints =
            ElectrificationConstraints(
                fullInfra.blockInfra,
                fullInfra.rawInfra,
                listOf(rollingStock)
            )

        val signalingSystemConstraints =
            makeSignalingSystemConstraints(
                fullInfra.blockInfra,
                fullInfra.signalingSimulator,
                listOf(rollingStock)
            )

        val combiner = ConstraintCombiner<BlockId, Block>()
        combiner.functions.addAll(
            arrayListOf(
                loadingGaugeConstraints,
                electrificationConstraints,
                signalingSystemConstraints
            )
        )

        for (location in locations) {
            val infraExplorers =
                initInfraExplorerWithEnvelope(
                    graph.fullInfra,
                    location,
                    endBlocks,
                    rollingStock,
                    combiner
                )
            for (explorer in infraExplorers) {
                val edges =
                    STDCMEdgeBuilder(explorer, graph)
                        .setStartTime(startTime)
                        .setStartOffset(location.offset)
                        .setPrevMaximumAddedDelay(maxDepartureDelay)
                        .makeAllEdges()
                for (edge in edges) res.add(Pathfinding.EdgeLocation(edge, Offset(0.meters)))
            }
        }
        return res
    }

    /** ---- TEST PATHFINDING BIS ---- */
    @JvmRecord
    private data class Step<STDCMEdge, OffsetType>(
        val range: EdgeRange<STDCMEdge, OffsetType>, // Range covered by this step
        val prev: Step<STDCMEdge, OffsetType>?, // Previous step (to construct the result)
        val totalDistance: Double, // Total distance from the start
        val weight:
            Double, // Priority queue weight (could be different from totalDistance to allow for A*)
        val nReachedTargets: Int, // How many targets we found by this path
        val targets: List<EdgeLocation<STDCMEdge, OffsetType>>
    ) : Comparable<Step<STDCMEdge, OffsetType>> {
        override fun compareTo(other: Step<STDCMEdge, OffsetType>): Int {
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

    /** Step priority queue */
    private val queue = PriorityQueue<Step<STDCMEdge, OffsetType>>()

    /**
     * Keeps track of visited location. For each visited range, keeps the max number of passed
     * targets at that point
     */
    private val seen = HashMap<EdgeRange<STDCMEdge, OffsetType>, Int>()

    /** Function to call to know the cost of the range. */
    private var edgeRangeCost: EdgeRangeCost<STDCMEdge, OffsetType>? = null

    /** Timeout, in seconds, to avoid infinite loop when no path can be found. */
    private var timeout = TIMEOUT

    /** Sets the functor used to estimate the cost for a range */
    fun setEdgeRangeCost(
        f: EdgeRangeCost<STDCMEdge, OffsetType>?
    ): STDCMPathfindingB<NodeT, EdgeT, OffsetType> {
        edgeRangeCost = f
        return this
    }

    /** Sets the pathfinding's timeout */
    fun setTimeout(timeout: Double?): STDCMPathfindingB<NodeT, EdgeT, OffsetType> {
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
        targets: List<Collection<EdgeLocation<STDCMEdge, OffsetType>>>
    ): Result<STDCMEdge, OffsetType>? {
        // We convert the targets of each step into functions, to call the more generic overload of
        // this
        // method below
        val starts = targets[0]
        val targetsOnEdges = ArrayList<TargetsOnEdge<STDCMEdge, OffsetType>>()
        for (i in 1 until targets.size) {
            targetsOnEdges.add { edge: STDCMEdge ->
                val res = HashSet<EdgeLocation<STDCMEdge, OffsetType>>()
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
        starts: Collection<EdgeLocation<STDCMEdge, OffsetType>>,
        targetsOnEdges: List<TargetsOnEdge<STDCMEdge, OffsetType>>
    ): Result<STDCMEdge, OffsetType>? {
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
            val endNode = graph!!.getEdgeEnd(step.range.edge)
            if (seen.getOrDefault(step.range, -1) >= step.nReachedTargets) continue
            seen[step.range] = step.nReachedTargets
            if (hasReachedEnd(targetsOnEdges.size, step)) return buildResult(step)
            // Check if the next target is reached in this step, only if the step doesn't already
            // reach a
            // step
            if (step.prev == null || step.nReachedTargets == step.prev.nReachedTargets)
                for (target in targetsOnEdges[step.nReachedTargets].apply(step.range.edge)) if (
                    step.range.start <= target.offset
                ) {
                    // Adds a new step precisely on the stop location. This ensures that we don't
                    // ignore the
                    // distance between the start of the edge and the stop location
                    var newRange = EdgeRange(target.edge, step.range.start, target.offset)
                    // newRange = filterRange(newRange)!!
                    if (newRange.end != target.offset) {
                        // The target location is blocked by a blocked range, it can't be accessed
                        // from here
                        continue
                    }
                    val stepTargets = java.util.ArrayList(step.targets)
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
            if (step.range.end == edgeLength) {
                // We reach the end of the edge: we visit neighbors
                val neighbors = graph!!.getAdjacentEdges(endNode)
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
        targets: List<Collection<EdgeLocation<STDCMEdge, OffsetType>>>
    ): List<STDCMEdge>? {
        val res = runPathfinding(targets) ?: return null
        return res.ranges
            .stream()
            .map { step: EdgeRange<STDCMEdge, OffsetType> -> step.edge }
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
    private fun hasReachedEnd(nTargets: Int, step: Step<STDCMEdge, OffsetType>): Boolean {
        return step.nReachedTargets >= nTargets
    }

    /** Builds the result, iterating over the previous steps and merging ranges */
    private fun buildResult(lastStep: Step<STDCMEdge, OffsetType>): Result<STDCMEdge, OffsetType> {
        var mutLastStep: Step<STDCMEdge, OffsetType>? = lastStep
        val orderedSteps = ArrayDeque<Step<STDCMEdge, OffsetType>>()
        while (mutLastStep != null) {
            orderedSteps.addFirst(mutLastStep)
            mutLastStep = mutLastStep.prev
        }
        val ranges = java.util.ArrayList<EdgeRange<STDCMEdge, OffsetType>>()
        val waypoints = java.util.ArrayList<EdgeLocation<STDCMEdge, OffsetType>>()
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
    /* private fun filterRange(range: EdgeRange<STDCMEdge, OffsetType>): EdgeRange<STDCMEdge, OffsetType>? {
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
    } */

    /** Registers one step, adding the edge to the queue if not already seen */
    private fun registerStep(
        range: EdgeRange<STDCMEdge, OffsetType>,
        prev: Step<STDCMEdge, OffsetType>?,
        prevDistance: Double,
        nPassedTargets: Int,
        targets: List<EdgeLocation<STDCMEdge, OffsetType>> = listOf()
    ) {
        // val filteredRange = filterRange(range) ?: return --> plus besoin si on ne filtre plus
        val filteredRange = EdgeRange(range.edge, range.start, range.end)
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
                    filteredRange.start as Offset<STDCMEdge> // A supprimer
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

typealias EdgeLocation<T, U> = Pathfinding.EdgeLocation<T, U>

typealias EdgeRange<T, U> = Pathfinding.EdgeRange<T, U>
