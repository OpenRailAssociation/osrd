package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.envelope_sim.pipelines.SimStop
import fr.sncf.osrd.envelope_sim.pipelines.maxEffortEnvelopeFrom
import fr.sncf.osrd.envelope_sim.pipelines.maxSpeedEnvelopeFrom
import fr.sncf.osrd.envelope_sim_infra.computeMRSP
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlockRanges
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.OPEN
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP
import fr.sncf.osrd.sim_infra.impl.TemporarySpeedLimitManager
import fr.sncf.osrd.stdcm.STDCMResult
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.arePositionsEqual
import fr.sncf.osrd.utils.areSpeedsEqual
import fr.sncf.osrd.utils.isTimeStrictlyPositive
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import io.opentelemetry.api.trace.SpanKind
import io.opentelemetry.instrumentation.annotations.WithSpan
import kotlin.math.abs
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
    fun makeResult(
        infra: FullInfra,
        path: Result,
        standardAllowance: AllowanceValue?,
        rollingStock: RollingStock,
        timeStep: Double,
        comfort: Comfort?,
        maxRunTime: Double,
        blockAvailability: BlockAvailabilityInterface,
        trainTag: String?,
        temporarySpeedLimitManager: TemporarySpeedLimitManager,
    ): STDCMResult? {
        val edges = path.edges
        val lastExplorer = edges.last().infraExplorer
        val blockRanges = lastExplorer.getAllBlocks()
        val routes = lastExplorer.getExploredRoutes()
        val trainPath =
            buildTrainPathFromBlockRanges(
                infra.rawInfra,
                infra.blockInfra,
                blockRanges,
                routes = routes,
            )

        val updatedTimeData = computeTimeData(edges)
        val stops = makeStops(edges, updatedTimeData)
        val maxSpeedEnvelope =
            makeMaxSpeedEnvelope(
                trainPath,
                stops,
                rollingStock,
                timeStep,
                comfort,
                trainTag,
                temporarySpeedLimitManager,
                areSpeedsEqual(0.0, edges.last().endSpeed),
            )
        val withAllowance =
            buildFinalEnvelope(
                graph,
                maxSpeedEnvelope,
                edges,
                standardAllowance,
                trainPath,
                rollingStock,
                timeStep,
                comfort,
                blockAvailability,
                stops,
                updatedTimeData,
            )
        val res =
            STDCMResult(
                withAllowance,
                trainPath,
                routes,
                updatedTimeData.departureTime,

                // Allow us to display OP, a hack that will be fixed
                // after the redesign of simulation data models
                makePathStops(stops, trainPath),
                lastExplorer.getStepTracker().getSeenSteps().map { it.travelledPathOffset },
            )
        return if (res.envelope.totalTime > maxRunTime) {
            // This can happen if the destination is one edge away from being reachable in time,
            // as we only check the time at the start of an edge when exploring the graph
            null
        } else res
    }

    private fun makeMaxSpeedEnvelope(
        trainPath: TrainPath,
        stops: List<TrainStop>,
        rollingStock: RollingStock,
        timeStep: Double,
        comfort: Comfort?,
        trainTag: String?,
        temporarySpeedLimitManager: TemporarySpeedLimitManager?,
        stopAtEnd: Boolean,
    ): Envelope {
        val context = build(rollingStock, trainPath, timeStep, comfort)
        val mrsp = computeMRSP(trainPath, rollingStock, false, trainTag, temporarySpeedLimitManager)
        val stopInfos =
            stops.map { SimStop(Offset(it.position.meters), it.receptionSignal) }.toMutableList()
        if (stopAtEnd) stopInfos.add(SimStop(Offset(trainPath.getLength()), SHORT_SLIP_STOP))
        val maxSpeedEnvelope = maxSpeedEnvelopeFrom(context, stopInfos, mrsp)
        return maxEffortEnvelopeFrom(context, 0.0, maxSpeedEnvelope)
    }

    /**
     * Compute the final TimeData to be used as reference. The main things we're looking for are the
     * train departure time and the duration of each stop.
     */
    private fun computeTimeData(edges: List<STDCMEdge>): TimeData {
        // Make stop list mutable (locally)
        val nodes = getNodes(edges)
        val mutableStopData = nodes.last().timeData.stopTimeData.toMutableList()
        var timeData = nodes.last().timeData.copy(stopTimeData = mutableStopData)

        // Find the index of the only planned node
        val (valid, maybeIndex) = checkPlannedStepsAndMaybeIndex(nodes.map { it.plannedTimingData })
        assert(valid)
        // Note: used in tests
        if (maybeIndex == null) {
            return timeData
        }
        // Either departure or arrival
        val plannedNodeIndex = maybeIndex
        val plannedNode = nodes[plannedNodeIndex]

        // Figure out how much time we'd like to add
        val realTime = plannedNode.getRealTime(timeData)
        var timeDiff = plannedNode.plannedTimingData!!.getTimeDiff(realTime)
        if (timeDiff > 0) return timeData // No change required
        timeDiff = abs(timeDiff)

        // If we are planning the departure, we just need to delay it
        if (plannedNodeIndex == 0) {
            val addedDepartureDelay = min(timeData.maxFirstDepartureDelaying, timeDiff)
            timeData = timeData.copy(departureTime = timeData.departureTime + addedDepartureDelay)
            return timeData
        }

        // Below, plannedNode is the arrival
        // Index of the last stop *before* the arrival (in the mutableStopData list)
        val lastStopIndexBeforeArrival =
            nodes.subList(0, plannedNodeIndex).count { it.stopDuration != null }
        // Identify how much time we can add to the previous stop without causing conflict
        val maxAddedTime =
            findMaxPossibleTimeToAdd(lastStopIndexBeforeArrival, plannedNode, timeData)
        var actualStopAddedTime = min(maxAddedTime, timeDiff)

        // Add time to the previous stop, or delay the departure time accordingly
        // We prefer delaying the departure time when possible
        val addedDepartureDelay = min(actualStopAddedTime, timeData.maxFirstDepartureDelaying)
        timeData = timeData.copy(departureTime = timeData.departureTime + addedDepartureDelay)
        actualStopAddedTime -= addedDepartureDelay

        if (actualStopAddedTime > 0) {
            mutableStopData[lastStopIndexBeforeArrival - 1] =
                mutableStopData[lastStopIndexBeforeArrival - 1].withAddedStopTime(
                    actualStopAddedTime
                )
        }

        return timeData
    }

    /**
     * Identify the max possible time we can add to the previous stop, assuming we are at arrival.
     */
    private fun findMaxPossibleTimeToAdd(
        lastStopIndexBeforeNode: Int,
        arrivalNode: STDCMNode,
        lastTimeData: TimeData,
    ): Double {
        if (lastStopIndexBeforeNode == 0) return lastTimeData.maxFirstDepartureDelaying
        return arrivalNode.timeData.stopTimeData.last().maxDepartureDelayBeforeStop
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
                        // TODO: forward and use receptionSignal param from request
                        if (isTimeStrictlyPositive(prevNode.stopDuration)) SHORT_SLIP_STOP else OPEN,
                    )
                )
            offset += edge.length.distance
        }
        return res
    }

    /** Builds the list of stops from OP */
    private fun makeOpStops(trainPath: TrainPath): List<TrainStop> {
        val res = ArrayList<TrainStop>()
        for ((_, offset) in trainPath.getOperationalPointParts()) {
            res.add(TrainStop(offset.meters, 0.0, OPEN))
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
    private fun makePathStops(stops: List<TrainStop>, trainPath: TrainPath): List<TrainStop> {
        val mutStops = stops.toMutableList()
        mutStops.addAll(makeOpStops(trainPath))
        return sortAndMergeStopsDuplicates(mutStops)
    }
}
