package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.api.pathfinding.makeOperationalPoints
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.graph.Pathfinding.EdgeRange
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.graph.PathfindingEdgeRangeId
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.stdcm.STDCMResult
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.RollingStock.Comfort
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.*

/**
 * This class contains all the static methods used to turn the raw pathfinding result into a full
 * response. This includes creating the final envelope (merging the parts + applying the allowances)
 */
class STDCMPostProcessingB(private val graph: STDCMGraph) {
    /**
     * Builds the STDCM result object from the raw pathfinding result. This is the only non-private
     * method of this class, the rest is implementation detail.
     */
    fun makeResult(
        infra: RawSignalingInfra?,
        path: Result,
        startTime: Double,
        standardAllowance: AllowanceValue?,
        rollingStock: RollingStock?,
        timeStep: Double,
        comfort: Comfort?,
        maxRunTime: Double,
        blockAvailability: BlockAvailabilityInterface
    ): STDCMResult? {
        val ranges = makeEdgeRange(path)
        val blockRanges = makeBlockRanges(ranges)
        val blockWaypoints = makeBlockWaypoints(path)
        val chunkPath = makeChunkPathFromRanges(graph, ranges)
        val trainPath = makePathProperties(infra!!, chunkPath)
        val physicsPath = EnvelopeTrainPath.from(infra, trainPath)
        val mergedEnvelopes = mergeEnvelopeRanges(ranges, physicsPath)
        val departureTime = computeDepartureTime(ranges, startTime)
        val stops = makeStops(ranges)
        val withAllowance =
            applyAllowance(
                graph,
                mergedEnvelopes,
                ranges,
                standardAllowance,
                physicsPath,
                rollingStock,
                timeStep,
                comfort,
                blockAvailability,
                departureTime,
                stops
            )
        val res =
            STDCMResult(
                Pathfinding.Result(blockRanges, blockWaypoints),
                withAllowance,
                trainPath,
                chunkPath,
                physicsPath,
                departureTime,

                // Allow us to display OP, a hack that will be fixed
                // after the redesign of simulation data models
                makePathStops(stops, infra, trainPath)
            )
        return if (res.envelope.totalTime > maxRunTime) {
            // This can happen if the destination is one edge away from being reachable in time,
            // as we only check the time at the start of an edge when exploring the graph
            null
        } else res
    }
}

/** Creates the list of waypoints on the path */
private fun makeBlockWaypoints(path: Result): List<PathfindingEdgeLocationId<Block>> {
    val res = ArrayList<PathfindingEdgeLocationId<Block>>()
    for (waypoint in path.waypoints) {
        val blockOffset = convertOffsetToBlock(waypoint.offset, waypoint.edge.envelopeStartOffset)
        res.add(EdgeLocation(waypoint.edge.block, blockOffset))
    }
    return res
}

/**
 * Builds the actual list of EdgeRange given the raw result of the pathfinding. We can't use the
 * pathfinding result directly because we use our own method to keep track of previous nodes/edges.
 */
private fun makeEdgeRange(raw: Result): List<EdgeRange<STDCMEdge, STDCMEdge>> {
    val orderedEdges = ArrayDeque<STDCMEdge>()
    var firstRange = EdgeRange(raw.edges[0], Offset(0.meters), raw.edges[0].length)
    var lastRange =
        EdgeRange(
            raw.edges[raw.edges.size - 1],
            Offset(0.meters),
            raw.edges[raw.edges.size - 1].length
        )
    var current = lastRange.edge
    while (true) {
        orderedEdges.addFirst(current)
        if (current.previousNode == null) break
        current = current.previousNode!!.previousEdge
    }
    firstRange = EdgeRange(orderedEdges.removeFirst(), firstRange.start, firstRange.end)
    if (lastRange.edge !== firstRange.edge)
        lastRange = EdgeRange(orderedEdges.removeLast(), lastRange.start, lastRange.end)
    val res = ArrayList<EdgeRange<STDCMEdge, STDCMEdge>>()
    res.add(firstRange)
    for (edge in orderedEdges) res.add(EdgeRange(edge, Offset(0.meters), edge.length))
    if (firstRange.edge !== lastRange.edge) res.add(lastRange)
    return res
}

/** Builds the list of stops from the ranges */
private fun makeStops(ranges: List<EdgeRange<STDCMEdge, STDCMEdge>>): List<TrainStop> {
    val res = ArrayList<TrainStop>()
    var offset = 0.meters
    for (range in ranges) {
        val prevNode = range.edge.previousNode
        if (
            (prevNode != null) &&
                (prevNode.stopDuration!! >= 0) &&
                (range.start == Offset<STDCMEdge>(0.meters))
        )
            res.add(TrainStop(offset.meters, prevNode.stopDuration))
        offset += range.end - range.start
    }
    return res
}

/** Builds the list of block ranges, merging the ranges on the same block */
private fun makeBlockRanges(
    ranges: List<EdgeRange<STDCMEdge, STDCMEdge>>
): List<PathfindingEdgeRangeId<Block>> {
    val res = ArrayList<PathfindingEdgeRangeId<Block>>()
    var i = 0
    while (i < ranges.size) {
        val range = ranges[i]
        val start = convertOffsetToBlock(range.start, range.edge.envelopeStartOffset)
        var length = range.end - range.start
        while (i + 1 < ranges.size) {
            val nextRange = ranges[i + 1]
            if (range.edge.block != nextRange.edge.block) break
            length += nextRange.end - nextRange.start
            i++
        }
        val end = start + length
        res.add(EdgeRange(range.edge.block, start, end))
        i++
    }
    return res
}

/** Builds the list of stops from OP */
private fun makeOpStops(infra: RawSignalingInfra, trainPath: PathProperties): List<TrainStop> {
    val operationalPoints = makeOperationalPoints(infra, trainPath)
    val res = ArrayList<TrainStop>()
    for (op in operationalPoints) {
        res.add(TrainStop(op.pathOffset, 0.0))
    }
    return res
}

/** Sorts the stops on the path. When stops overlap, the user-defined one is kept. */
private fun sortAndMergeStopsDuplicates(stops: List<TrainStop>): List<TrainStop> {
    val sorted = stops.sortedBy { st: TrainStop -> st.position }
    val res = ArrayList<TrainStop>()
    var last: TrainStop? = null
    for (stop in sorted) {
        if (last != null && TrainPhysicsIntegrator.arePositionsEqual(last.position, stop.position))
            last.position = stop.position
        else {
            last = stop
            res.add(last)
        }
    }
    return res
}

/**
 * Make the path's ordered list of stops, in order. Both user-defined stops and operational points.
 */
private fun makePathStops(
    stops: List<TrainStop>,
    infra: RawSignalingInfra,
    trainPath: PathProperties
): List<TrainStop> {
    val mutStops = stops.toMutableList()
    mutStops.addAll(makeOpStops(infra, trainPath))
    return sortAndMergeStopsDuplicates(mutStops)
}
