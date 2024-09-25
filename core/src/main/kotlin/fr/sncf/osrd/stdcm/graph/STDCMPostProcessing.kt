package fr.sncf.osrd.stdcm.graph

import datadog.trace.api.Trace
import fr.sncf.osrd.api.pathfinding.makeOperationalPoints
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.EnvelopeSimPath
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.*
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.envelope_sim_infra.computeMRSP
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.graph.Pathfinding.EdgeRange
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.graph.PathfindingEdgeRangeId
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.PathProperties
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.sim_infra.api.makePathProperties
import fr.sncf.osrd.stdcm.STDCMResult
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.units.meters
import io.opentelemetry.api.trace.SpanKind
import io.opentelemetry.instrumentation.annotations.WithSpan
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * This class contains all the static methods used to turn the raw pathfinding result into a full
 * response. This includes creating the final envelope (merging the parts + applying the allowances)
 */
class STDCMPostProcessing(private val graph: STDCMGraph) {
    /**
     * Builds the STDCM result object from the raw pathfinding result. This is the only non-private
     * method of this class, the rest is implementation detail.
     */
    @WithSpan(value = "STDCM post processing", kind = SpanKind.SERVER)
    @Trace(operationName = "STDCM post processing")
    fun makeResult(
        infra: RawSignalingInfra,
        path: Result,
        standardAllowance: AllowanceValue?,
        rollingStock: RollingStock,
        timeStep: Double,
        comfort: Comfort?,
        maxRunTime: Double,
        blockAvailability: BlockAvailabilityInterface,
        trainTag: String?
    ): STDCMResult? {
        val edges = path.edges
        val blockRanges = makeBlockRanges(edges)
        val blockWaypoints = makeBlockWaypoints(path)
        val chunkPath = makeChunkPathFromEdges(graph, edges)
        val routes = edges.last().infraExplorer.getExploredRoutes()
        val trainPath = makePathProperties(infra, chunkPath, routes)
        val physicsPath = EnvelopeTrainPath.from(infra, trainPath)
        // val departureTime = computeDepartureTime(edges, startTime)
        val updatedTimeData = computeTimeData(edges)
        val stops = makeStops(edges, updatedTimeData)
        val maxSpeedEnvelope =
            makeMaxSpeedEnvelope(
                trainPath,
                physicsPath,
                stops,
                rollingStock,
                timeStep,
                comfort,
                trainTag,
                areSpeedsEqual(0.0, edges.last().endSpeed)
            )
        val withAllowance =
            buildFinalEnvelope(
                graph,
                maxSpeedEnvelope,
                edges,
                standardAllowance,
                physicsPath,
                rollingStock,
                timeStep,
                comfort,
                blockAvailability,
                stops,
                updatedTimeData,
            )
        val res =
            STDCMResult(
                Pathfinding.Result(blockRanges, blockWaypoints),
                withAllowance,
                trainPath,
                chunkPath,
                physicsPath,
                updatedTimeData.departureTime,

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

    private fun makeMaxSpeedEnvelope(
        trainPath: PathProperties,
        physicsPath: EnvelopeSimPath,
        stops: List<TrainStop>,
        rollingStock: RollingStock,
        timeStep: Double,
        comfort: Comfort?,
        trainTag: String?,
        stopAtEnd: Boolean,
    ): Envelope {
        val context = build(rollingStock, physicsPath, timeStep, comfort)
        val mrsp = computeMRSP(trainPath, rollingStock, false, trainTag)
        val stopPositions = stops.map { it.position }.toMutableList()
        if (stopAtEnd) stopPositions.add(physicsPath.length)
        val maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stopPositions.toDoubleArray(), mrsp)
        return MaxEffortEnvelope.from(context, 0.0, maxSpeedEnvelope)
    }

    /** Creates the list of waypoints on the path */
    private fun makeBlockWaypoints(path: Result): List<PathfindingEdgeLocationId<Block>> {
        val res = ArrayList<PathfindingEdgeLocationId<Block>>()
        for (waypoint in path.waypoints) {
            val blockOffset = waypoint.edge.blockOffsetFromEdge(waypoint.offset)
            res.add(EdgeLocation(waypoint.edge.block, blockOffset))
        }
        return res
    }

    /**
     * Compute the final TimeData to be used as reference. The main things we're looking for are the
     * train departure time and the duration of each stop.
     */
    private fun computeTimeData(
        edges: List<STDCMEdge>,
    ): TimeData {
        // Make stop list mutable (locally)
        val nodes = getNodes(edges)
        val mutableStopData = nodes.last().timeData.stopTimeData.toMutableList()
        var timeData = nodes.last().timeData.copy(stopTimeData = mutableStopData)

        // Find the index of the first planned node, and matching stop index
        val firstPlannedNodeIndex = nodes.indexOfFirst { it.plannedTimingData != null }
        if (firstPlannedNodeIndex < 0) return timeData
        val node = nodes[firstPlannedNodeIndex]
        // Index of the last stop *before* the first planned node (in the mutableStopData list)
        val lastStopIndexBeforeNode =
            nodes.subList(0, firstPlannedNodeIndex).count { it.stopDuration != null }

        // Figure out how much time we'd like to add
        val realTime = node.getRealTime(timeData)
        var timeDiff = node.plannedTimingData!!.getTimeDiff(realTime)
        if (timeDiff > 0) return timeData // No change required
        timeDiff = abs(timeDiff)

        // Identify how much time we can add to the previous stop without causing conflict
        var maxAddedTime =
            findMaxPossibleTimeToAdd(
                lastStopIndexBeforeNode,
                node,
                nodes.subList(firstPlannedNodeIndex + 1, nodes.size),
                mutableStopData,
            )
        val actualStopAddedTime = min(maxAddedTime, timeDiff)

        // Add time to the previous stop, or delay the departure time accordingly
        if (lastStopIndexBeforeNode == 0)
            timeData = timeData.copy(departureTime = timeData.departureTime + actualStopAddedTime)
        else
            mutableStopData[lastStopIndexBeforeNode - 1] =
                mutableStopData[lastStopIndexBeforeNode - 1].withAddedStopTime(actualStopAddedTime)

        // Reduce time to the next stops, to keep the change as local as possible
        reduceNextStopDurations(
            lastStopIndexBeforeNode,
            actualStopAddedTime,
            nodes.subList(firstPlannedNodeIndex + 1, nodes.size),
            mutableStopData,
        )
        return timeData
    }

    /** Reduce the duration of the next stops to account for any extra time we have added before */
    private fun reduceNextStopDurations(
        lastStopIndexBeforeNode: Int,
        maxTimeDiff: Double,
        nextNodes: List<STDCMNode>,
        mutableStopData: MutableList<StopTimeData>,
    ) {
        var addedStopTimeIndex = lastStopIndexBeforeNode
        var remainingStopTimeToRemove = maxTimeDiff
        for (nextNode in nextNodes) {
            if (nextNode.stopDuration != null) {
                val newStopDuration =
                    max(
                        mutableStopData[addedStopTimeIndex].minDuration,
                        mutableStopData[addedStopTimeIndex].currentDuration -
                            remainingStopTimeToRemove
                    )
                val timeRemoved =
                    mutableStopData[addedStopTimeIndex].currentDuration - newStopDuration
                mutableStopData[addedStopTimeIndex] =
                    mutableStopData[addedStopTimeIndex].copy(currentDuration = newStopDuration)
                remainingStopTimeToRemove -= timeRemoved
                if (remainingStopTimeToRemove <= 0) break
                addedStopTimeIndex++
            }
        }
    }

    /**
     * Identify the max possible time we can add to the previous stop, assuming we can remove some
     * time from next stops
     */
    private fun findMaxPossibleTimeToAdd(
        lastStopIndexBeforeNode: Int,
        node: STDCMNode,
        nextNodes: List<STDCMNode>,
        mutableStopData: MutableList<StopTimeData>,
    ): Double {
        var maxTimeDiff = Double.POSITIVE_INFINITY
        var nextStopIndex = lastStopIndexBeforeNode
        if (node.stopDuration != null) nextStopIndex++
        var timeRemovedFromStops = 0.0
        for (nextNode in nextNodes) {
            // Using the edge is more reliable to check the lack of conflict
            val edge = nextNode.previousEdge!!
            maxTimeDiff =
                min(
                    maxTimeDiff,
                    edge.timeData.maxDepartureDelayingWithoutConflict - timeRemovedFromStops
                )
            if (nextNode.stopDuration != null) {
                val maxRemovedStopTime =
                    mutableStopData[nextStopIndex].currentDuration -
                        mutableStopData[nextStopIndex].currentDuration
                timeRemovedFromStops += maxRemovedStopTime
                nextStopIndex++
            }
        }
        return maxTimeDiff
    }

    private fun getNodes(edges: List<STDCMEdge>): List<STDCMNode> {
        val nodes = edges.map { it.previousNode }.toMutableList()
        nodes.add(edges.last().getEdgeEnd(graph))
        return nodes
    }

    /** Builds the list of stops from the edges */
    private fun makeStops(edges: List<STDCMEdge>, timeData: TimeData): List<TrainStop> {
        val res = ArrayList<TrainStop>()
        var offset = 0.meters
        var stopIndex = 0
        for (edge in edges) {
            val prevNode = edge.previousNode
            // Ignore first path node and last node (we aren't checking lastEdge.getEdgeEnd())
            if (prevNode.previousEdge != null && prevNode.stopDuration != null)
                res.add(
                    TrainStop(
                        offset.meters,
                        timeData.stopTimeData[stopIndex++].currentDuration,
                        // TODO: forward and use onStopSignal param from request
                        isTimeStrictlyPositive(prevNode.stopDuration)
                    )
                )
            offset += edge.length.distance
        }
        return res
    }

    /** Builds the list of block ranges, merging the ranges on the same block */
    private fun makeBlockRanges(edges: List<STDCMEdge>): List<PathfindingEdgeRangeId<Block>> {
        val res = ArrayList<PathfindingEdgeRangeId<Block>>()
        var i = 0
        while (i < edges.size) {
            val edge = edges[i]
            val start = edge.envelopeStartOffset
            var length = edge.length
            while (i + 1 < edges.size) {
                val nextEdge = edges[i + 1]
                if (edge.block != nextEdge.block) break
                length += nextEdge.length.distance
                i++
            }
            val end = start + length.distance
            res.add(EdgeRange(edge.block, start, end))
            i++
        }
        return res
    }

    /** Builds the list of stops from OP */
    private fun makeOpStops(infra: RawSignalingInfra, trainPath: PathProperties): List<TrainStop> {
        val operationalPoints = makeOperationalPoints(infra, trainPath)
        val res = ArrayList<TrainStop>()
        for (op in operationalPoints) {
            res.add(TrainStop(op.pathOffset, 0.0, false))
        }
        return res
    }

    /** Sorts the stops on the path. When stops overlap, the user-defined one is kept. */
    private fun sortAndMergeStopsDuplicates(stops: List<TrainStop>): List<TrainStop> {
        val sorted = stops.sortedBy { st: TrainStop -> st.position }
        val res = ArrayList<TrainStop>()
        var last: TrainStop? = null
        for (stop in sorted) {
            if (last != null && arePositionsEqual(last.position, stop.position))
                last.position = stop.position
            else {
                last = stop
                res.add(last)
            }
        }
        return res
    }

    /**
     * Make the path's ordered list of stops, in order. Both user-defined stops and operational
     * points.
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
}
