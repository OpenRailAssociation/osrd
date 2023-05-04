package fr.sncf.osrd.stdcm.graph

import com.google.common.collect.Iterables
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView
import fr.sncf.osrd.infra_state.api.TrainPath
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder
import fr.sncf.osrd.stdcm.STDCMResult
import fr.sncf.osrd.stdcm.preprocessing.interfaces.RouteAvailabilityInterface
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.RollingStock.Comfort
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.graph.Pathfinding
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeRange
import java.util.*
import kotlin.math.abs

/** This file contains all the static methods used to turn the raw pathfinding result into a full response.
 * This includes creating the final envelope (merging the parts + applying the allowances)  */

/** Builds the STDCM result object from the raw pathfinding result.
 * This is the only non-private method of this class, the rest is implementation detail.  */
fun makeResult(
    path: Pathfinding.Result<STDCMEdge?>,
    startTime: Double,
    standardAllowance: AllowanceValue?,
    rollingStock: RollingStock,
    timeStep: Double,
    comfort: Comfort?,
    maxRunTime: Double,
    routeAvailability: RouteAvailabilityInterface
): STDCMResult? {
    val ranges = makeEdgeRange(path)
    val routeRanges = makeRouteRanges(ranges)
    val routeWaypoints = makeRouteWaypoints(path)
    val physicsPath = EnvelopeTrainPath.from(makeTrackRanges(ranges))
    val mergedEnvelopes = mergeEnvelopeRanges(ranges)
    val departureTime = computeDepartureTime(ranges, startTime)
    val stops = makeStops(ranges)
    val withAllowance = applyAllowance(
        mergedEnvelopes,
        ranges,
        standardAllowance,
        physicsPath,
        rollingStock,
        timeStep,
        comfort,
        routeAvailability,
        departureTime,
        stops
    )
    val res = STDCMResult(
        Pathfinding.Result(routeRanges, routeWaypoints),
        withAllowance,
        makeTrainPath(ranges),
        physicsPath,
        departureTime,
        stops
    )
    return if (res.envelope.totalTime > maxRunTime) {
        // This can happen if the destination is one edge away from being reachable in time,
        // as we only check the time at the start of an edge when exploring the graph
        null
    } else res
}

/** Creates the list of waypoints on the path  */
private fun makeRouteWaypoints(
    path: Pathfinding.Result<STDCMEdge?>
): List<EdgeLocation<SignalingRoute>> {
    val res = ArrayList<EdgeLocation<SignalingRoute>>()
    for (waypoint in path.waypoints) {
        val routeOffset = waypoint.offset + waypoint.edge!!.envelopeStartOffset
        res.add(EdgeLocation(waypoint.edge!!.route, routeOffset))
    }
    return res
}

/** Builds the list of route ranges, merging the ranges on the same route  */
private fun makeRouteRanges(
    ranges: List<EdgeRange<STDCMEdge?>>
): List<EdgeRange<SignalingRoute>> {
    val res = ArrayList<EdgeRange<SignalingRoute>>()
    var i = 0
    while (i < ranges.size) {
        val range = ranges[i]
        val edge = range.edge!!
        val start = range.start + edge.envelopeStartOffset
        var length = range.end - range.start
        while (i + 1 < ranges.size) {
            val nextRange = ranges[i + 1]
            if (edge.route != nextRange.edge!!.route) break
            length += nextRange.end - nextRange.start
            i++
        }
        var end = start + length
        val routeLength = edge.route.infraRoute.length
        if (abs(end - routeLength) < TrainPhysicsIntegrator.POSITION_EPSILON)
            end = routeLength
        res.add(EdgeRange(edge.route, start, end))
        i++
    }
    return res
}

/** Builds the actual list of EdgeRange given the raw result of the pathfinding.
 * We can't use the pathfinding result directly because we use our own method
 * to keep track of previous nodes/edges.  */
private fun makeEdgeRange(
    raw: Pathfinding.Result<STDCMEdge?>
): List<EdgeRange<STDCMEdge?>> {
    val orderedEdges = ArrayDeque<STDCMEdge?>()
    var firstRange = raw.ranges[0]
    var lastRange = raw.ranges[raw.ranges.size - 1]
    var current = lastRange.edge
    while (true) {
        orderedEdges.addFirst(current!!)
        if (current.previousNode == null) break
        current = current.previousNode!!.previousEdge
    }
    firstRange = EdgeRange(orderedEdges.removeFirst(), firstRange.start, firstRange.end)
    if (lastRange.edge !== firstRange.edge) lastRange =
        EdgeRange(orderedEdges.removeLast(), lastRange.start, lastRange.end)
    val res = ArrayList<EdgeRange<STDCMEdge?>>()
    res.add(firstRange)
    for (edge in orderedEdges)
        res.add(EdgeRange(edge, 0.0, edge!!.length))
    if (firstRange.edge !== lastRange.edge)
        res.add(lastRange)
    return res
}

/** Converts the list of pathfinding edges into a list of TrackRangeView that covers the path exactly  */
private fun makeTrackRanges(
    edges: List<EdgeRange<STDCMEdge?>>
): List<TrackRangeView> {
    val trackRanges = ArrayList<TrackRangeView>()
    for (routeRange in edges) {
        val infraRoute = routeRange.edge!!.route.infraRoute
        val startOffset = routeRange.edge!!.envelopeStartOffset
        trackRanges.addAll(
            infraRoute.getTrackRanges(
                startOffset + routeRange.start,
                startOffset + routeRange.end
            )
        )
    }
    return trackRanges
}

/** Creates a TrainPath instance from the list of pathfinding edges  */
private fun makeTrainPath(
    ranges: List<EdgeRange<STDCMEdge?>>
): TrainPath {
    val routeList = ArrayList<SignalingRoute>()
    for (range in ranges) {
        if (routeList.isEmpty() || Iterables.getLast(routeList) != range.edge!!.route)
            routeList.add(range.edge!!.route)
    }
    val trackRanges = makeTrackRanges(ranges)
    val lastRange = trackRanges[trackRanges.size - 1]
    return TrainPathBuilder.from(
        routeList,
        trackRanges[0].offsetLocation(0.0),
        lastRange.offsetLocation(lastRange.length)
    )
}

/** Computes the departure time, made of the sum of all delays added over the path  */
private fun computeDepartureTime(ranges: List<EdgeRange<STDCMEdge?>>, startTime: Double): Double {
    var time = startTime
    for (range in ranges)
        time += range.edge!!.addedDelay
    return time
}

/** Builds the list of stops from the ranges  */
private fun makeStops(ranges: List<EdgeRange<STDCMEdge?>>): MutableList<TrainStop> {
    val res = ArrayList<TrainStop>()
    var offset = 0.0
    for (range in ranges) {
        val prevNode = range.edge!!.previousNode
        if (prevNode != null && prevNode.stopDuration >= 0 && range.start == 0.0)
            res.add(
                TrainStop(
                    offset,
                    prevNode.stopDuration
                )
            )
        offset += range.end - range.start
    }
    return res
}
