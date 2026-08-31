package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.api.ConsistSchedule
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.envelope_sim.Comfort
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.pathfinding.Pathfinding
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.impl.TemporarySpeedLimitManager
import fr.sncf.osrd.stdcm.STDCMResult
import fr.sncf.osrd.stdcm.infra_exploration.ExplorerStep
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.infra_exploration.LocatedStep
import fr.sncf.osrd.stdcm.infra_exploration.initInfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.stdcm.tracing.FailureExplainer
import fr.sncf.osrd.stdcm.tracing.ProgressCallback
import fr.sncf.osrd.stdcm.tracing.ProgressLogger
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.LogAggregator
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import io.opentelemetry.api.trace.Span
import io.opentelemetry.api.trace.SpanKind
import io.opentelemetry.instrumentation.annotations.WithSpan
import java.time.Duration
import java.time.Instant
import java.util.*
import kotlin.Double.Companion.POSITIVE_INFINITY
import org.slf4j.Logger
import org.slf4j.LoggerFactory

data class EdgeLocation(val edge: STDCMEdge, val offset: Offset<STDCMEdge>)

data class Result(val node: STDCMNode) {
    val hasReachedDestination = node.infraExplorer.getStepTracker().hasReachedDestination()
}

data class PathResult(
    val edges: List<STDCMEdge>, // Full path as a list of edges
    val waypoints: List<EdgeLocation>,
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
    consistSchedule: ConsistSchedule,
    comfort: Comfort?,
    startTime: Double,
    steps: List<ExplorerStep>,
    blockAvailability: BlockAvailabilityInterface,
    timeStep: Double,
    maxDepartureDelay: Double,
    maxRunTime: Double,
    tag: String?,
    standardAllowance: AllowanceValue?,
    pathfindingTimeout: Double,
    temporarySpeedLimitManager: TemporarySpeedLimitManager,
    searchMetadata: STDCMGraph.SearchMetadata? = null,
    fullFailureExplainer: FailureExplainer? = null,
    workSchedulesFailureExplainer: FailureExplainer? = null,
    progressCallback: ProgressCallback? = null,
): STDCMResult? {
    return STDCMPathfinding(
            fullInfra,
            consistSchedule,
            comfort,
            startTime,
            steps,
            blockAvailability,
            timeStep,
            maxDepartureDelay,
            maxRunTime,
            tag,
            standardAllowance,
            pathfindingTimeout,
            temporarySpeedLimitManager,
            searchMetadata,
            fullFailureExplainer,
            workSchedulesFailureExplainer,
            progressCallback,
        )
        .findPath()
}

class STDCMPathfinding(
    private val fullInfra: FullInfra,
    private val consistSchedule: ConsistSchedule,
    private val comfort: Comfort?,
    private val startTime: Double,
    private val steps: List<ExplorerStep>,
    private val blockAvailability: BlockAvailabilityInterface,
    private val timeStep: Double,
    private val maxDepartureDelay: Double,
    private val maxRunTime: Double,
    tag: String?,
    standardAllowance: AllowanceValue?,
    private val pathfindingTimeout: Double = Pathfinding.TIMEOUT,
    temporarySpeedLimitManager: TemporarySpeedLimitManager,
    searchMetadata: STDCMGraph.SearchMetadata?,
    fullFailureExplainer: FailureExplainer?,
    workSchedulesFailureExplainer: FailureExplainer?,
    private val progressCallback: ProgressCallback? = null,
) {

    private var starts: Set<STDCMNode> = HashSet()

    var graph: STDCMGraph =
        STDCMGraph(
            fullInfra,
            consistSchedule,
            comfort,
            timeStep,
            blockAvailability,
            maxRunTime,
            startTime,
            steps,
            tag,
            standardAllowance,
            temporarySpeedLimitManager,
            searchMetadata,
            fullFailureExplainer,
            workSchedulesFailureExplainer,
        )

    @WithSpan(value = "STDCM pathfinding", kind = SpanKind.SERVER)
    fun findPath(): STDCMResult? {
        runInputSanityChecks()

        assert(steps.last().stop) { "The last stop is supposed to be an actual stop" }
        starts = getStartNodes(graph, consistSchedule)

        // If we are in a dead end, and the destination is not reached, the pathfinding should fail
        if (starts.isEmpty()) return null

        val result = findPathImpl()
        graph.stdcmSimulations.logWarnings()
        if (!result.hasReachedDestination) {
            logger.info("Failed to reach destination, start postprocessing partial result")
            return STDCMPostProcessing(graph).makePartialResult(fullInfra, result.node)
        }

        logger.info("Reached destination, start postprocessing")
        val path = buildPath(result.node)
        val res =
            STDCMPostProcessing(graph)
                .makeCompleteResult(
                    fullInfra,
                    path,
                    graph.standardAllowance,
                    consistSchedule.rollingStocks as List<RollingStock>,
                    timeStep,
                    comfort,
                    maxRunTime,
                    blockAvailability,
                ) ?: return null
        val travelTime = res.envelope.totalTime
        val stopTime = res.stopResults.sumOf { it.duration }
        val relativeTimeUsed = (travelTime + stopTime) / maxRunTime
        Span.current().setAttribute("departure delay", res.departureTime.toString())
        Span.current().setAttribute("total movement duration", travelTime.toString())
        Span.current().setAttribute("total stops duration", stopTime.toString())
        Span.current()
            .setAttribute("(arrival time - departure time) / duration limit", relativeTimeUsed)
        logger.info(
            "departure delay = +${res.departureTime.toInt()}s, " +
                "total movement duration = ${res.envelope.totalTime.toInt()}s, " +
                "total stops duration = $stopTime, " +
                "(arrival time - departure time) / duration limit = ${relativeTimeUsed.toInt()}s"
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
        // Check consist changes
        if (consistSchedule.rollingStocks.size != steps.size) {
            throw OSRDError(ErrorType.InvalidSTDCMInputs)
                .withContext("cause", "Different number of rolling stocks and steps")
        }
        // Check that the step timing makes sense: they can be reached in order and inside the
        // search time window
        val maxArrivalTime = startTime + maxDepartureDelay + maxRunTime
        val minArrivalTime = startTime
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

    private fun findPathImpl(): Result {
        val queue = PriorityQueue<STDCMNode>()

        val progressLogger = ProgressLogger(graph, callback = progressCallback)
        val fValueLogger = LogAggregator({ logger.error(it) })

        for (location in starts) {
            queue.add(location)
        }
        val start = Instant.now()
        var lastFValue = Double.NEGATIVE_INFINITY
        var closestNode: STDCMNode = queue.peek()
        while (true) {
            if (Duration.between(start, Instant.now()).toSeconds() >= pathfindingTimeout)
                throw OSRDError(ErrorType.PathfindingTimeoutError)
            val endNode = queue.poll()
            if (endNode == null) {
                fValueLogger.logAggregatedSummary()
                return Result(closestNode)
            }
            if (endNode.getMinTotalSimulationTime(graph.remainingTimeEstimator) > maxRunTime)
                continue

            // Checks that the f-value (best anticipated final value on path) only goes up,
            // otherwise the A* heuristic isn't admissible
            val fValue = endNode.timeData.totalRunningTime + endNode.remainingTimeEstimation
            if (fValue + 1.0 < lastFValue) { // Small tolerance
                // We don't need to crash, logging an error is enough
                fValueLogger.registerError("f-value decreases: new=$fValue, previous=$lastFValue")
            }
            lastFValue = fValue

            progressLogger.processNode(endNode)
            if (endNode.infraExplorer.getStepTracker().hasReachedDestination()) {
                return Result(endNode)
            }
            queue += getAdjacentNodes(endNode)
            if (endNode.remainingTimeEstimation < closestNode.remainingTimeEstimation) {
                closestNode = endNode
            }
        }
    }

    private fun getAdjacentNodes(node: STDCMNode): Collection<STDCMNode> {
        return graph
            .getAdjacentEdges(node)
            .map { it.getEdgeEnd(graph) }
            .filter { it.timeData.timeSinceDeparture + it.remainingTimeEstimation <= maxRunTime }
            .filter { graph.tryMarkPending(it) }
    }

    private fun buildPath(node: STDCMNode): PathResult {
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

        val reachedSteps =
            node.infraExplorer.getStepTracker().iterateReachedStepsBackwards().toList().asReversed()
        val waypoints = makeWaypoints(edgeList, reachedSteps)

        return PathResult(edgeList, waypoints)
    }

    /** Converts start locations into starting nodes. */
    private fun getStartNodes(graph: STDCMGraph, consistSchedule: ConsistSchedule): Set<STDCMNode> {
        val res = HashSet<STDCMNode>()
        val firstStep = steps[0]
        assert(!firstStep.stop)
        for (location in firstStep.locations) {
            val infraExplorers =
                initInfraExplorerWithEnvelope(fullInfra, location, consistSchedule, steps)
            val extended = infraExplorers.flatMap { extendLookaheadUntil(it, 3) }
            for (explorer in extended) {
                val node =
                    STDCMNode(
                        TimeData(
                            earliestReachableTime = startTime,
                            maxDepartureDelayingWithoutConflict = maxDepartureDelay,
                            departureTime = startTime,
                            timeOfNextConflictAtLocation = POSITIVE_INFINITY,
                            totalRunningTime = 0.0,
                            stopTimeData = listOf(),
                            maxFirstDepartureDelaying = maxDepartureDelay,
                        ),
                        0.0,
                        explorer as InfraExplorerWithEnvelope,
                        null,
                        location.offset,
                        null,
                        firstStep.plannedTimingData,
                        null,
                        graph.bestPossibleTime,
                        graph,
                    )
                res.add(node)
            }
        }
        return res
    }
}

private fun makeWaypoints(
    edges: List<STDCMEdge>,
    reachedSteps: List<LocatedStep>,
): List<EdgeLocation> {
    val res = mutableListOf<EdgeLocation>()
    var nextStepIndex = 0
    var edgeStartOffset = Offset<PhysicsPath>(0.meters)

    for (edge in edges) {
        val edgeEndOffset = edgeStartOffset + edge.length.distance
        while (
            nextStepIndex < reachedSteps.size &&
                edge.block == reachedSteps[nextStepIndex].location.edge &&
                reachedSteps[nextStepIndex].travelledPathOffset in edgeStartOffset..edgeEndOffset
        ) {
            val locationOnEdge =
                edge.edgeOffsetFromBlock(reachedSteps[nextStepIndex].location.offset)
            res.add(EdgeLocation(edge, locationOnEdge!!))
            nextStepIndex++
        }
        edgeStartOffset = edgeEndOffset
    }
    assert(edgeStartOffset == reachedSteps.last().travelledPathOffset)
    assert(reachedSteps.size == res.size)

    return res
}
