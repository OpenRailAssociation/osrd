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
import kotlin.collections.ArrayList
import kotlin.collections.HashSet

data class EdgeLocation(val edge: STDCMEdge, val offset: Offset<STDCMEdge>)

data class Result(
    val edges: List<STDCMEdge>, // Full path as edge ranges
    val waypoints: List<EdgeLocation>
)

fun findPath(
    fullInfra: FullInfra,
    rollingStock: RollingStock,
    comfort: RollingStock.Comfort?,
    startTime: Double,
    steps: List<STDCMStep>,
    blockAvailability: BlockAvailabilityInterface,
    timeStep: Double,
    maxDepartureDelay: Double,
    maxRunTime: Double,
    tag: String?,
    standardAllowance: AllowanceValue?,
    pathfindingTimeout: Double
): STDCMResult? {
    return STDCMPathfindingB(
            fullInfra,
            rollingStock,
            comfort,
            startTime,
            steps,
            blockAvailability,
            timeStep,
            maxDepartureDelay,
            maxRunTime,
            tag,
            standardAllowance,
            pathfindingTimeout
        )
        .findPath()
}

class STDCMPathfindingB(
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
    val pathfindingTimeout: Double = 120.0,
    var graph: STDCMGraph? = null,
) {

    private var edgeToLength: EdgeToLength<STDCMEdge, STDCMEdge>? = null
    private var estimateRemainingDistance: List<AStarHeuristic<STDCMEdge, STDCMEdge>>? = ArrayList()
    private var starts: Set<STDCMEdge> = HashSet()

    // TODO: maybe those could be local to the core function?
    private var seen = HashMap<STDCMEdge, Int>()
    private var queue = PriorityQueue<STDCMEdge>()

    init {
        graph =
            STDCMGraph(
                fullInfra,
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
        edgeToLength = EdgeToLength { edge -> edge.length.cast() }

        // TODO: figure out what should and should not be in the init
    }

    fun findPath(): STDCMResult? {
        assert(steps.size >= 2) { "Not enough steps have been set to find a path" }

        // Initialize the A* heuristic
        val locations = steps.stream().map(STDCMStep::locations).toList()
        val remainingDistanceEstimators = makeHeuristics(fullInfra, locations)
        estimateRemainingDistance = makeAStarHeuristic(remainingDistanceEstimators, rollingStock)

        val endBlocks = steps.last().locations.map { it.edge }
        starts =
            convertLocations(
                graph!!,
                steps[0].locations,
                startTime,
                maxDepartureDelay,
                rollingStock,
                endBlocks
            )
        val path = findPathImpl() ?: return null

        return STDCMPostProcessingB(graph!!)
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

    private fun findPathImpl(): Result? {
        checkParameters()
        for (location in starts) {
            val len = edgeToLength!!.apply(location)
            val totalCostUntilEdge = computeTotalCostUntilEdge(location, len)
            val distanceLeftEstimation =
                // TODO: inconsistent, same as Pathfinding
                estimateRemainingDistance!![0].apply(location, Offset(0.meters))
            location.weight = distanceLeftEstimation + totalCostUntilEdge
            queue.add(location)
        }
        val start = Instant.now()
        while (true) {
            if (Duration.between(start, Instant.now()).toSeconds() >= pathfindingTimeout)
                throw OSRDError(ErrorType.PathfindingTimeoutError)
            val edge = queue.poll() ?: return null
            // TODO: we mostly reason in terms of endNode, we should probably change the queue.
            val endNode = edge.getEdgeEnd(graph!!)
            if (seen.getOrDefault(edge, -1) >= endNode.waypointIndex) continue
            seen[edge] = endNode.waypointIndex
            if (endNode.waypointIndex >= graph!!.steps.size - 1) {
                return buildResult(edge)
            }
            val neighbors = graph!!.getAdjacentEdges(endNode)
            for (neighbor in neighbors) {
                val len = edgeToLength!!.apply(neighbor)
                val totalCostUntilEdge = computeTotalCostUntilEdge(neighbor, len)
                var distanceLeftEstimation = 0.0
                if (neighbor.waypointIndex < estimateRemainingDistance!!.size)
                    distanceLeftEstimation =
                        estimateRemainingDistance!![neighbor.waypointIndex].apply(
                            neighbor,
                            // TODO: inconsistent, same as Pathfinding
                            Offset(0.meters)
                        )
                neighbor.weight = totalCostUntilEdge + distanceLeftEstimation
                queue.add(neighbor)
            }
        }
    }

    private fun buildResult(edge: STDCMEdge): Result {
        var mutLastEdge: STDCMEdge? = edge
        val edges = ArrayDeque<STDCMEdge>()
        val waypoints = ArrayList<EdgeLocation>()
        while (mutLastEdge != null) {
            edges.addFirst(mutLastEdge)
            val nbWaypoints = mutLastEdge.waypointIndex
            mutLastEdge = mutLastEdge.previousNode?.previousEdge
            if (mutLastEdge == null) {
                break
            }
            val newNbWaypoints = mutLastEdge.waypointIndex
            // TODO: check off-by-one and offset
            if (nbWaypoints > newNbWaypoints) {
                waypoints.add(EdgeLocation(mutLastEdge, Offset(0.meters)))
            }
        }
        return Result(edges.toList(), waypoints)
    }

    private fun checkParameters() {
        assert(estimateRemainingDistance != null) { "The A* heuristic has not been initialized" }
        assert(edgeToLength != null) { "The edge to length function has not been initialized" }
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
    private fun computeTotalCostUntilEdge(edge: STDCMEdge, len: Offset<STDCMEdge>): Double {
        val envelope = edge.envelope
        val timeEnd =
            interpolateTime(envelope, len, edge.timeStart, edge.standardAllowanceSpeedFactor)
        val pathDuration = timeEnd - edge.totalDepartureTimeShift
        return pathDuration * maxDepartureDelay + edge.totalDepartureTimeShift
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
    ): Set<STDCMEdge> {
        val res = HashSet<STDCMEdge>()

        val constraints = initConstraints(fullInfra, listOf(rollingStock))

        for (location in locations) {
            val infraExplorers =
                initInfraExplorerWithEnvelope(
                    graph.fullInfra,
                    location,
                    endBlocks,
                    rollingStock,
                    constraints
                )
            for (explorer in infraExplorers) {
                val edges =
                    STDCMEdgeBuilder(explorer, graph)
                        .setStartTime(startTime)
                        .setStartOffset(location.offset)
                        .setPrevMaximumAddedDelay(maxDepartureDelay)
                        .makeAllEdges()
                for (edge in edges) res.add(edge)
            }
        }
        return res
    }
}
