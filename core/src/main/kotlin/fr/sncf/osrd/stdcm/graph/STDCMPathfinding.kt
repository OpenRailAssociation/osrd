package fr.sncf.osrd.stdcm.graph

import datadog.trace.api.Trace
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.pathfinding.constraints.ConstraintCombiner
import fr.sncf.osrd.api.pathfinding.constraints.initConstraints
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.stdcm.ProgressLogger
import fr.sncf.osrd.stdcm.STDCMResult
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.infra_exploration.initInfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.units.Offset
import io.opentelemetry.api.trace.SpanKind
import io.opentelemetry.instrumentation.annotations.WithSpan
import java.time.Duration
import java.time.Instant
import java.util.*
import org.slf4j.Logger
import org.slf4j.LoggerFactory

data class EdgeLocation(val edge: STDCMEdge, val offset: Offset<STDCMEdge>)

data class Result(
    val edges: List<STDCMEdge>, // Full path as a list of edges
    val waypoints: List<EdgeLocation>
)

val logger: Logger = LoggerFactory.getLogger("STDCM")

/**
 * Find a path for a new train that exclusively uses tracks at times when they're available.
 *
 * For a detailed explanation of how this module works, there is some general documentation on the
 * OSRD website: https://osrd.fr/en/docs/reference/design-docs/stdcm/
 */
fun findPath(
    fullInfra: FullInfra,
    rollingStock: RollingStock,
    comfort: Comfort?,
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
    private val comfort: Comfort?,
    private val startTime: Double,
    private val steps: List<STDCMStep>,
    private val blockAvailability: BlockAvailabilityInterface,
    private val timeStep: Double,
    private val maxDepartureDelay: Double,
    private val maxRunTime: Double,
    tag: String?,
    standardAllowance: AllowanceValue?,
    private val pathfindingTimeout: Double = Pathfinding.TIMEOUT
) {

    private var starts: Set<STDCMNode> = HashSet()

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

    @WithSpan(value = "STDCM pathfinding", kind = SpanKind.SERVER)
    @Trace(operationName = "STDCM pathfinding")
    fun findPath(): STDCMResult? {
        runInputSanityChecks()

        val constraints =
            ConstraintCombiner(initConstraints(fullInfra, listOf(rollingStock)).toMutableList())

        assert(steps.last().stop) { "The last stop is supposed to be an actual stop" }
        val stops = steps.filter { it.stop }.map { it.locations }
        assert(stops.isNotEmpty())
        starts = getStartNodes(stops, listOf(constraints))
        val path = findPathImpl()
        if (path == null) {
            logger.info("Failed to find a path")
            return null
        }
        logger.info("Path found, start postprocessing")

        val res =
            STDCMPostProcessing(graph)
                .makeResult(
                    fullInfra.rawInfra,
                    path,
                    graph.standardAllowance,
                    rollingStock,
                    timeStep,
                    comfort,
                    maxRunTime,
                    blockAvailability,
                    graph.tag
                ) ?: return null
        logger.info(
            "departure time = +${res.departureTime.toInt()}s, " +
                "total travel time = ${res.envelope.totalTime.toInt()}s, " +
                "total stop time = ${res.stopResults.sumOf { it.duration }.toInt()}s"
        )
        return res
    }

    /**
     * Run sanity checks on the inputs, to raise relevant errors if the inputs can't possibly lead
     * to a valid solution.
     */
    private fun runInputSanityChecks() {
        if (steps.size < 2)
            throw OSRDError(ErrorType.InvalidSTDCMInputs)
                .withContext("cause", "Not enough steps have been set to find a path")

        // Check that the step timing makes sense: they can be reached in order and inside the
        // search time window
        val maxArrivalTime = startTime + maxDepartureDelay + maxRunTime
        var minArrivalTime = startTime
        for ((i, step) in steps.withIndex()) {
            val stepTiming = step.plannedTimingData
            if (stepTiming != null) {
                val earliestAllowedArrival =
                    stepTiming.arrivalTime.seconds - stepTiming.arrivalTimeToleranceBefore.seconds
                val latestAllowedArrival =
                    stepTiming.arrivalTime.seconds + stepTiming.arrivalTimeToleranceAfter.seconds
                if (
                    earliestAllowedArrival > maxArrivalTime || latestAllowedArrival < minArrivalTime
                )
                    throw OSRDError(ErrorType.InvalidSTDCMInputs)
                        .withContext("cause", "Step $i timing is outside the search time window")
            }
        }
    }

    private fun findPathImpl(): Result? {
        val queue = PriorityQueue<STDCMNode>()

        val progressLogger = ProgressLogger(graph)

        for (location in starts) {
            queue.add(location)
        }
        val start = Instant.now()
        while (true) {
            if (Duration.between(start, Instant.now()).toSeconds() >= pathfindingTimeout)
                throw OSRDError(ErrorType.PathfindingTimeoutError)
            val endNode = queue.poll() ?: return null
            progressLogger.processNode(endNode)
            if (endNode.timeData.timeSinceDeparture + endNode.remainingTimeEstimation > maxRunTime)
                return null
            if (endNode.waypointIndex >= graph.steps.size - 1) {
                return buildResult(endNode)
            }
            queue += getAdjacentNodes(endNode)
        }
    }

    private fun getAdjacentNodes(node: STDCMNode): Collection<STDCMNode> {
        return graph.getAdjacentEdges(node).map { it.getEdgeEnd(graph) }
    }

    private fun buildResult(node: STDCMNode): Result {
        var mutLastEdge: STDCMEdge? = node.previousEdge
        val edges = ArrayDeque<STDCMEdge>()

        while (mutLastEdge != null) {
            edges.addFirst(mutLastEdge)
            mutLastEdge = mutLastEdge.previousNode.previousEdge
            if (mutLastEdge == null) {
                break
            }
        }

        val edgeList = edges.toList()
        return Result(edgeList, makeWaypoints(edgeList))
    }

    private fun makeWaypoints(edges: List<STDCMEdge>): List<EdgeLocation> {
        var nextStepIndex = 0
        var currentEdgeIndex = 0
        val res = mutableListOf<EdgeLocation>()
        while (currentEdgeIndex < edges.size && nextStepIndex < steps.size) {
            val step = steps[nextStepIndex]
            val edge = edges[currentEdgeIndex]
            val locationOnEdge =
                step.locations
                    .filter { it.edge == edge.block }
                    .mapNotNull { edge.edgeOffsetFromBlock(it.offset) }
                    .minOrNull()
            // Sometimes a step has several locations on the same edge, we just pick the first
            if (locationOnEdge != null) {
                res.add(EdgeLocation(edge, locationOnEdge))
                nextStepIndex++
            } else {
                currentEdgeIndex++
            }
        }
        assert(nextStepIndex == steps.size)
        assert(currentEdgeIndex == edges.size - 1)
        return res
    }

    /** Converts start locations into starting nodes. */
    private fun getStartNodes(
        stops: List<Collection<PathfindingEdgeLocationId<Block>>> = listOf(),
        constraints: List<PathfindingConstraint<Block>>
    ): Set<STDCMNode> {
        val res = HashSet<STDCMNode>()
        val firstStep = steps[0]
        assert(!firstStep.stop)
        for (location in firstStep.locations) {
            val infraExplorers =
                initInfraExplorerWithEnvelope(fullInfra, location, rollingStock, stops, constraints)
            val extended = infraExplorers.flatMap { extendLookaheadUntil(it, 3) }
            for (explorer in extended) {
                val node =
                    STDCMNode(
                        TimeData(
                            earliestReachableTime = startTime,
                            maxDepartureDelayingWithoutConflict = maxDepartureDelay,
                            departureTime = startTime,
                            timeOfNextConflictAtLocation = 0.0,
                            totalRunningTime = 0.0,
                            stopTimeData = listOf(),
                        ),
                        0.0,
                        explorer as InfraExplorerWithEnvelope,
                        null,
                        0,
                        location.offset,
                        null,
                        firstStep.plannedTimingData,
                        null,
                        0.0,
                    )
                res.add(node)
            }
        }
        return res
    }
}
