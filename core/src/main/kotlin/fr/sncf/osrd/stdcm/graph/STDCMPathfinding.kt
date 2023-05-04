package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.api.pathfinding.PathfindingRoutesEndpoint
import fr.sncf.osrd.api.pathfinding.constraints.ElectrificationConstraints
import fr.sncf.osrd.api.pathfinding.constraints.LoadingGaugeConstraints
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.infra.api.signaling.SignalingInfra
import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import fr.sncf.osrd.stdcm.STDCMResult
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.stdcm.preprocessing.interfaces.RouteAvailabilityInterface
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.RollingStock.Comfort
import fr.sncf.osrd.utils.graph.Pathfinding
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.utils.graph.functional_interfaces.AStarHeuristic
import fr.sncf.osrd.utils.graph.functional_interfaces.TargetsOnEdge
import okhttp3.internal.immutableListOf

/** This file combines all the (static) methods used to find a path in the STDCM graph.  */

/** Given an infra, a rolling stock and a collection of unavailable time for each route,
 * find a path made of a sequence of route ranges with a matching envelope.
 * Returns null if no path is found.
 */
fun findPath(
    infra: SignalingInfra,
    rollingStock: RollingStock,
    comfort: Comfort?,
    startTime: Double,
    endTime: Double,
    steps: List<STDCMStep>,
    routeAvailability: RouteAvailabilityInterface,
    timeStep: Double,
    maxDepartureDelay: Double,
    maxRunTime: Double,
    tag: String?,
    standardAllowance: AllowanceValue?
): STDCMResult? {
    assert(steps.size >= 2) { "Not enough steps have been set to find a path" }
    val graph = STDCMGraph(
        infra,
        rollingStock,
        comfort,
        timeStep,
        routeAvailability,
        maxRunTime,
        startTime,
        steps,
        tag,
        standardAllowance
    )

    // Initializes the constraints
    val loadingGaugeConstraints = LoadingGaugeConstraints(immutableListOf(rollingStock))
    val electrificationConstraints = ElectrificationConstraints(immutableListOf(rollingStock))

    // Initialize the A* heuristic
    val locations = steps.stream()
        .map(STDCMStep::locations)
        .toList()
    val remainingDistanceEstimators = PathfindingRoutesEndpoint.makeHeuristics(locations)
    val path = Pathfinding(graph)
        .setEdgeToLength { edge: STDCMEdge? -> edge!!.route.infraRoute.length }
        .setRemainingDistanceEstimator(makeAStarHeuristic(remainingDistanceEstimators, rollingStock))
        .setEdgeToLength { edge: STDCMEdge? -> edge!!.length}
        .addBlockedRangeOnEdges { edge: STDCMEdge? -> loadingGaugeConstraints.apply(edge!!.route) }
        .addBlockedRangeOnEdges { edge: STDCMEdge? -> electrificationConstraints.apply(edge!!.route) }
        .setTotalCostUntilEdgeLocation { location: EdgeLocation<STDCMEdge?>? ->
            totalCostUntilEdgeLocation(
                location!!,
                maxDepartureDelay
            )
        }
        .runPathfinding(
            convertLocations(graph, steps[0].locations, startTime, maxDepartureDelay),
            makeObjectiveFunction(steps)
        ) ?: return null
    return STDCMPostProcessing.makeResult(
        path,
        startTime,
        graph.standardAllowance,
        rollingStock,
        timeStep,
        comfort,
        maxRunTime,
        routeAvailability
    )
}

/** Make the objective function from the edge locations  */
private fun makeObjectiveFunction(
    steps: List<STDCMStep>
): MutableList<TargetsOnEdge<STDCMEdge?>> {
    val globalResult = ArrayList<TargetsOnEdge<STDCMEdge?>>()
    for (i in 1 until steps.size) {
        val step = steps[i]
        globalResult.add(TargetsOnEdge { edge: STDCMEdge? ->
            edge!!
            val res = HashSet<EdgeLocation<STDCMEdge?>>()
            for (loc in step.locations) if (loc.edge == edge.route) {
                val offsetOnEdge = loc.offset - edge.envelopeStartOffset
                if (offsetOnEdge >= 0 && offsetOnEdge <= edge.length) res.add(EdgeLocation(edge, offsetOnEdge))
            }
            res
        })
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
    location: EdgeLocation<STDCMEdge?>,
    searchTimeRange: Double
): Double {
    val edge = location.edge!!
    val envelope = edge.envelope
    val timeEnd = STDCMSimulations.interpolateTime(
        envelope,
        edge.envelopeStartOffset,
        location.offset,
        edge.timeStart,
        edge.standardAllowanceSpeedFactor
    )
    val pathDuration = timeEnd - edge.totalDepartureTimeShift
    return pathDuration * searchTimeRange + edge.totalDepartureTimeShift
}

/** Converts the "raw" heuristics based on infra graph, returning the most optimistic distance,
 * into heuristics based on stdcm edges, returning the most optimistic time  */
private fun makeAStarHeuristic(
    signalingRouteHeuristics: ArrayList<AStarHeuristic<SignalingRoute>>,
    rollingStock: RollingStock
): MutableList<AStarHeuristic<STDCMEdge?>> {
    val res = ArrayList<AStarHeuristic<STDCMEdge?>>()
    for (signalingRouteHeuristic in signalingRouteHeuristics) {
        res.add(AStarHeuristic { edge: STDCMEdge?, offset: Double ->
            val distance = signalingRouteHeuristic.apply(edge!!.route, offset)
            distance / rollingStock.maxSpeed
        })
    }
    return res
}

/** Converts locations on a SignalingRoute into a location on a STDCMGraph.Edge.  */
private fun convertLocations(
    graph: STDCMGraph,
    locations: Collection<EdgeLocation<SignalingRoute>>,
    startTime: Double,
    maxDepartureDelay: Double
): MutableCollection<EdgeLocation<STDCMEdge?>> {
    val res = HashSet<EdgeLocation<STDCMEdge?>>()
    for (location in locations) {
        val start = location.offset
        val edges = STDCMEdgeBuilder(location.edge, graph)
            .setStartTime(startTime)
            .setStartOffset(start)
            .setPrevMaximumAddedDelay(maxDepartureDelay)
            .makeAllEdges()
        for (edge in edges) res.add(EdgeLocation(edge, 0.0))
    }
    return res
}
