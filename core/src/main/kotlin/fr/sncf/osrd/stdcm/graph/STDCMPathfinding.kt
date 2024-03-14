package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.pathfinding.constraints.*
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.graph.*
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.stdcm.STDCMResult
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.stdcm.infra_exploration.initInfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.makeSTDCMHeuristics
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.units.Offset
import java.time.Duration
import java.time.Instant
import java.util.*
import kotlin.collections.ArrayList
import kotlin.collections.HashSet

data class EdgeLocation(val edge: STDCMEdge, val offset: Offset<STDCMEdge>)

data class Result(
    val edges: List<STDCMEdge>, // Full path as a list of edges
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
    return STDCMPathfinding(
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

class STDCMPathfinding(
    private val fullInfra: FullInfra,
    private val rollingStock: RollingStock,
    private val comfort: RollingStock.Comfort?,
    private val startTime: Double,
    private val steps: List<STDCMStep>,
    private val blockAvailability: BlockAvailabilityInterface,
    private val timeStep: Double,
    private val maxDepartureDelay: Double,
    private val maxRunTime: Double,
    private val tag: String?,
    private val standardAllowance: AllowanceValue?,
    private val pathfindingTimeout: Double = 120.0
) {

    private var estimateRemainingDistance: List<AStarHeuristic<STDCMEdge, STDCMEdge>>? = ArrayList()
    private var starts: Set<STDCMEdge> = HashSet()

    var graph: STDCMGraph =
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

    fun findPath(): STDCMResult? {
        assert(steps.size >= 2) { "Not enough steps have been set to find a path" }

        // Initialize the A* heuristic
        estimateRemainingDistance =
            makeSTDCMHeuristics(
                fullInfra.blockInfra,
                fullInfra.rawInfra,
                steps,
                maxRunTime,
                rollingStock,
                maxDepartureDelay
            )

        val constraints =
            ConstraintCombiner(initConstraints(fullInfra, listOf(rollingStock)).toMutableList())

        val endBlocks = steps.last().locations.map { it.edge }
        starts =
            convertLocations(
                graph,
                steps[0].locations,
                startTime,
                maxDepartureDelay,
                rollingStock,
                endBlocks,
                listOf(constraints)
            )
        val path = findPathImpl() ?: return null

        return STDCMPostProcessing(graph)
            .makeResult(
                fullInfra.rawInfra,
                path,
                startTime,
                graph.standardAllowance,
                rollingStock,
                timeStep,
                comfort,
                maxRunTime,
                blockAvailability,
                graph.tag
            )
    }

    private fun findPathImpl(): Result? {
        val queue = PriorityQueue<STDCMEdge>()
        for (location in starts) {
            val totalCostUntilEdge = computeTotalCostUntilEdge(location)
            val distanceLeftEstimation =
                estimateRemainingDistance!![0].apply(location, location.length)
            location.weight = distanceLeftEstimation + totalCostUntilEdge
            queue.add(location)
        }
        val start = Instant.now()
        while (true) {
            if (Duration.between(start, Instant.now()).toSeconds() >= pathfindingTimeout)
                throw OSRDError(ErrorType.PathfindingTimeoutError)
            val edge = queue.poll() ?: return null
            // TODO: we mostly reason in terms of endNode, we should probably change the queue.
            val endNode = graph.getEdgeEnd(edge)
            if (endNode.waypointIndex >= graph.steps.size - 1) {
                return buildResult(edge)
            }
            val neighbors = graph.getAdjacentEdges(endNode)
            for (neighbor in neighbors) {
                val totalCostUntilEdge = computeTotalCostUntilEdge(neighbor)
                var distanceLeftEstimation = 0.0
                if (neighbor.waypointIndex < estimateRemainingDistance!!.size)
                    distanceLeftEstimation =
                        estimateRemainingDistance!![neighbor.waypointIndex].apply(
                            neighbor,
                            neighbor.length
                        )
                neighbor.weight = totalCostUntilEdge + distanceLeftEstimation
                queue.add(neighbor)
            }
        }
    }

    private fun buildResult(edge: STDCMEdge): Result {
        var mutLastEdge: STDCMEdge? = edge
        val edges = ArrayDeque<STDCMEdge>()

        while (mutLastEdge != null) {
            edges.addFirst(mutLastEdge)
            mutLastEdge = mutLastEdge.previousNode?.previousEdge
            if (mutLastEdge == null) {
                break
            }
        }

        // FIXME: We return an empty list of waypoints (not used for now)
        return Result(edges.toList(), listOf())
    }

    /**
     * Compute the total cost of a path (in s) to an edge location This estimation of the total cost
     * is used to compare paths in the pathfinding algorithm. We select the shortest path (in
     * duration), and for 2 paths with the same duration, we select the earliest one. The path
     * weight which takes into account the total duration of the path and the time shift at the
     * departure (with different weights): path_duration * maxDepartureDelay + departure_time_shift.
     *
     * <br></br> EXAMPLE Let's assume we are trying to find a train between 9am and 10am. The
     * maxDepartureDelay is 1 hour (3600s). Let's assume we have found two possible trains:
     * - the first one leaves at 9:59 and lasts for 20:00 min.
     * - the second one leaves at 9:00 and lasts for 20:01 min. As we are looking for the fastest
     *   train, the first train should have the lightest weight, which is the case with the formula
     *   above.
     */
    private fun computeTotalCostUntilEdge(edge: STDCMEdge): Double {
        val timeEnd = edge.getApproximateTimeAtLocation(edge.length)
        val pathDuration = timeEnd - edge.totalDepartureTimeShift
        return pathDuration * maxDepartureDelay + edge.totalDepartureTimeShift
    }

    /** Converts locations on a block id into a location on a STDCMGraph.Edge. */
    private fun convertLocations(
        graph: STDCMGraph,
        locations: Collection<PathfindingEdgeLocationId<Block>>,
        startTime: Double,
        maxDepartureDelay: Double,
        rollingStock: RollingStock,
        endBlocks: Collection<BlockId> = setOf(),
        constraints: List<PathfindingConstraint<Block>>
    ): Set<STDCMEdge> {
        val res = HashSet<STDCMEdge>()

        for (location in locations) {
            val infraExplorers =
                initInfraExplorerWithEnvelope(
                    fullInfra,
                    location,
                    endBlocks,
                    rollingStock,
                    constraints
                )
            val extended = infraExplorers.flatMap { extendLookaheadUntil(it, 4) }
            for (explorer in extended) {
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
