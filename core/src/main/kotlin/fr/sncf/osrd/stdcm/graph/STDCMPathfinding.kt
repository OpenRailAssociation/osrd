package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.pathfinding.constraints.ElectrificationConstraints
import fr.sncf.osrd.api.pathfinding.constraints.LoadingGaugeConstraints
import fr.sncf.osrd.api.pathfinding.makeHeuristics
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.graph.AStarHeuristic
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.graph.TargetsOnEdge
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.stdcm.STDCMResult
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.RollingStock.Comfort
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

/** Given an infra, a rolling stock and a collection of unavailable time for each block,
 * find a path made of a sequence of block ranges with a matching envelope.
 * Returns null if no path is found.
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
    assert(steps.size >= 2) { "Not enough steps have been set to find a path" }
    val graph = STDCMGraph(
        fullInfra.rawInfra,
        fullInfra.blockInfra,
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

    // Initializes the constraints
    val loadingGaugeConstraints = LoadingGaugeConstraints(
        fullInfra.blockInfra, fullInfra.rawInfra,
        listOf(rollingStock)
    )
    val electrificationConstraints = ElectrificationConstraints(
        fullInfra.blockInfra, fullInfra.rawInfra,
        listOf(rollingStock)
    )

    // Initialize the A* heuristic
    val locations = steps.stream()
        .map(STDCMStep::locations)
        .toList()
    val remainingDistanceEstimators = makeHeuristics(fullInfra, locations)
    val path = Pathfinding(graph)
        .setEdgeToLength { edge: STDCMEdge? -> fullInfra.blockInfra.getBlockLength(edge!!.block).distance }
        .setRemainingDistanceEstimator(makeAStarHeuristic(remainingDistanceEstimators, rollingStock))
        .setEdgeToLength { edge -> edge.length.distance }
        .addBlockedRangeOnEdges { edge: STDCMEdge? -> loadingGaugeConstraints.apply(edge!!.block) }
        .addBlockedRangeOnEdges { edge: STDCMEdge? -> electrificationConstraints.apply(edge!!.block) }
        .setTotalCostUntilEdgeLocation { range ->
            totalCostUntilEdgeLocation(
                range,
                maxDepartureDelay
            )
        }
        .setTimeout(pathfindingTimeout)
        .runPathfinding(
            convertLocations(graph, steps[0].locations, startTime, maxDepartureDelay),
            makeObjectiveFunction(steps)
        ) ?: return null
    return STDCMPostProcessing(graph).makeResult(
        fullInfra.rawInfra,
        path,
        startTime,
        graph.standardAllowance,
        rollingStock,
        timeStep,
        comfort,
        maxRunTime,
        blockAvailability
    )
}

/** Make the objective function from the edge locations  */
private fun makeObjectiveFunction(
    steps: List<STDCMStep>
): List<TargetsOnEdge<STDCMEdge>> {
    val globalResult = ArrayList<TargetsOnEdge<STDCMEdge>>()
    for (i in 1 until steps.size) {
        val step = steps[i]
        globalResult.add { edge ->
            val res = HashSet<EdgeLocation<STDCMEdge>>()
            for (loc in step.locations)
                if (loc.edge == edge.block) {
                    val offsetOnEdge = loc.offset - edge.envelopeStartOffset.distance
                    if (offsetOnEdge >= 0.meters && offsetOnEdge <= edge.length.distance)
                        res.add(EdgeLocation(edge, offsetOnEdge))
                }
            res
        }
    }
    return globalResult
}

/** Compute the total cost of a path (in s) to an edge location
 * This estimation of the total cost is used to compare paths in the pathfinding algorithm.
 * We select the shortest path (in duration), and for 2 paths with the same duration, we select the earliest one.
 * The path weight which takes into account the total duration of the path and the time shift at the departure
 * (with different weights): path_duration * searchTimeRange + departure_time_shift.
 *
 * <br></br>
 * EXAMPLE
 * Let's assume we are trying to find a train between 9am and 10am. The searchTimeRange is 1 hour (3600s).
 * Let's assume we have found two possible trains:
 * - the first one leaves at 9:59 and lasts for 20:00 min.
 * - the second one leaves at 9:00 and lasts for 20:01 min.
 * As we are looking for the fastest train, the first train should have the lightest weight, which is the case with
 * the formula above. */
private fun totalCostUntilEdgeLocation(
    range: EdgeLocation<STDCMEdge>,
    searchTimeRange: Double
): Double {
    val envelope = range.edge.envelope
    val timeEnd = interpolateTime(
        envelope,
        range.edge.envelopeStartOffset,
        Offset(range.offset),
        range.edge.timeStart,
        range.edge.standardAllowanceSpeedFactor
    )
    val pathDuration = timeEnd - range.edge.totalDepartureTimeShift
    return pathDuration * searchTimeRange + range.edge.totalDepartureTimeShift
}

/** Converts the "raw" heuristics based on physical blocks, returning the most optimistic distance,
 * into heuristics based on stdcm edges, returning the most optimistic time  */
private fun makeAStarHeuristic(
    baseBlockHeuristics: ArrayList<AStarHeuristic<BlockId>>,
    rollingStock: RollingStock
): List<AStarHeuristic<STDCMEdge>> {
    val res = ArrayList<AStarHeuristic<STDCMEdge>>()
    for (baseBlockHeuristic in baseBlockHeuristics) {
        res.add(AStarHeuristic { edge, offset ->
            val distance = baseBlockHeuristic.apply(edge.block, offset)
            distance / rollingStock.maxSpeed
        })
    }
    return res
}

/** Converts locations on a block id into a location on a STDCMGraph.Edge.  */
private fun convertLocations(
    graph: STDCMGraph,
    locations: Collection<EdgeLocation<BlockId>>,
    startTime: Double,
    maxDepartureDelay: Double
): Set<EdgeLocation<STDCMEdge>> {
    val res = HashSet<EdgeLocation<STDCMEdge>>()
    for (location in locations) {
        val edges = STDCMEdgeBuilder(location.edge, graph)
            .setStartTime(startTime)
            .setStartOffset(Offset(location.offset))
            .setPrevMaximumAddedDelay(maxDepartureDelay)
            .makeAllEdges()
        for (edge in edges)
            res.add(EdgeLocation(edge, 0.meters))
    }
    return res
}
