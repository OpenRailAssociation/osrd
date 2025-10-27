package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.lang.Double.isNaN

data class STDCMEdge(
    val timeData: TimeData,
    // Instance used to explore the infra, contains the current
    // underlying edge (block)
    val infraExplorer: InfraExplorerWithEnvelope,
    // Includes this edge's envelope
    val infraExplorerWithNewEnvelope: InfraExplorerWithEnvelope,
    // Node located at the start of this edge
    val previousNode: STDCMNode,
    // Offset of the envelope if it doesn't start at the beginning of the edge
    // This can *not* be used to convert Path / TravelledPath (should reference start of 1st route)
    val envelopeStartOffset: Offset<Block>,
    // True if the edge end is a stop
    val endAtStop: Boolean,
    // Speed at the beginning of the edge
    val beginSpeed: Double,
    // Speed at the end of the edge
    val endSpeed: Double,
    // Edge length
    val length: Length<STDCMEdge>,
    // How long it takes to go from the beginning to the end of the block, taking the
    // standard allowance into account
    val totalTime: Double,
    // If this edge starts at the end of an engineering allowance, this contains
    // some data like its length and extra time. Null if there's no engineering allowance
    // ending here. Overrides any allowance spanning part of the range from previous edges.
    val engineeringAllowance: EngineeringAllowanceData?,
    // Original envelope, not scaled for standard allowance. Needs to be scaled to interpolate times
    // or expected speed.
    val originalEnvelope: Envelope,
) {
    val block = infraExplorer.getCurrentBlock()

    init {
        assert(!isNaN(timeData.earliestReachableTime)) { "STDCM edge starts at NaN time" }
    }

    data class EngineeringAllowanceData(
        /** How long is the allowance section. It always ends at the start of the current edge. */
        val length: Distance,
        /** How much extra time was added on this current allowance range. */
        val extraDuration: Double,
    )

    /** Returns the node at the end of this edge */
    fun getEdgeEnd(graph: STDCMGraph): STDCMNode {
        val previousPlannedNodeRelativeTimeDiff = getPreviousPlannedNodeRelativeTimeDiff()
        val stepTracker = infraExplorer.getStepTracker()
        val newExplorer = infraExplorerWithNewEnvelope.clone()
        newExplorer
            .getStepTracker()
            .moveForward(
                infraExplorer.getCurrentBlock(),
                envelopeStartOffset,
                envelopeStartOffset + length.distance,
            )
        return if (!endAtStop) {
            // We move on to the next block
            STDCMNode(
                timeData.withAddedTime(totalTime, null, null),
                endSpeed,
                newExplorer,
                this,
                null,
                null,
                null,
                previousPlannedNodeRelativeTimeDiff,
                graph.remainingTimeEstimator.invoke(this, null, stepTracker),
                graph,
            )
        } else {
            // New edge on the same block, after a stop
            val nextStop = stepTracker.getStepsInLookahead().first { it.originalStep.stop }
            val stopDuration = nextStop.originalStep.duration
            val locationOnEdge = envelopeStartOffset + length.distance

            STDCMNode(
                timeData.withAddedTime(
                    totalTime,
                    stopDuration,
                    graph.delayManager.getMaxAdditionalStopDuration(
                        infraExplorerWithNewEnvelope,
                        getEdgeEndTime(),
                    ),
                ),
                endSpeed,
                newExplorer,
                this,
                envelopeStartOffset + length.distance,
                stopDuration,
                nextStop.originalStep.plannedTimingData,
                previousPlannedNodeRelativeTimeDiff,
                graph.remainingTimeEstimator.invoke(this, locationOnEdge, stepTracker),
                graph,
            )
        }
    }

    /**
     * Computes the last planned node's previousPlannedNodeRelativeTimeDiff, taking the potentially
     * new total departure time shift into account.
     */
    private fun getPreviousPlannedNodeRelativeTimeDiff(): Double? {
        var currentEdge: STDCMEdge? = this
        while (currentEdge != null) {
            val previousPlannedNode = currentEdge.previousNode
            if (previousPlannedNode.plannedTimingData != null) {
                return previousPlannedNode.getRelativeTimeDiff(timeData)
            }
            currentEdge = previousPlannedNode.previousEdge
        }
        return null
    }

    /**
     * Returns the approximate time of the given offset of the edge. Runs a simple linear
     * interpolation. The updated time data is used to account for any extra departure delay, it
     * should come from the last edge/node.
     */
    fun getApproximateTimeAtLocation(offset: Offset<STDCMEdge>, updatedTimeData: TimeData): Double {
        val updatedEarliestTime = timeData.getUpdatedEarliestReachableTime(updatedTimeData)
        if (length.distance == 0.meters) return updatedEarliestTime // Avoids division by 0
        val offsetRatio = offset.meters / length.meters
        return updatedEarliestTime + (totalTime * offsetRatio)
    }

    override fun toString(): String {
        return "STDCMEdge(timeStart=${timeData.earliestReachableTime}, block=$block)"
    }

    /**
     * Returns the offset on the edge referential from a given block offset, if it's covered by the
     * edge.
     */
    fun edgeOffsetFromBlock(blockOffset: Offset<Block>): Offset<STDCMEdge>? {
        val projectedOffset = Offset<STDCMEdge>(blockOffset - envelopeStartOffset)
        if (projectedOffset.distance < 0.meters || projectedOffset > length) return null
        return projectedOffset
    }

    /** Returns the offset on the block referential from a given edge offset. */
    fun blockOffsetFromEdge(edgeOffset: Offset<STDCMEdge>): Offset<Block> {
        return envelopeStartOffset + edgeOffset.distance
    }

    /** Return the time at which the train quits this edge and moves on to the next. */
    private fun getEdgeEndTime(): Double {
        return timeData.earliestReachableTime + totalTime
    }

    /**
     * Return how much delay we can add on this edge. We need to be given the time added on the next
     * edges (both departure delaying and allowances), as they carry over previous edges.
     */
    fun getMaxAddedDelay(addedAllowanceOnNextEdges: Double): Double {
        val maxAddedDelay = timeData.timeOfNextConflictAtLocation - getEdgeEndTime()
        return maxAddedDelay - addedAllowanceOnNextEdges
    }

    /** Return all delay added to this edge, engineering + departure delay */
    fun getTotalAddedDelayOnEdge(): Double {
        return timeData.delayAddedToLastDeparture + (engineeringAllowance?.extraDuration ?: 0.0)
    }
}
