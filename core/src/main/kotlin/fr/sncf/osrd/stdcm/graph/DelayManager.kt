package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.standalone_sim.EnvelopeStopWrapper
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface.Availability
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.units.Distance.Companion.fromMeters
import fr.sncf.osrd.utils.units.Offset
import java.util.*

/**
 * This class contains all the methods used to handle delays (how much we can add, how much we need
 * to add, and such)
 */
class DelayManager
internal constructor(
    private val minScheduleTimeStart: Double,
    private val maxRunTime: Double,
    private val blockAvailability: BlockAvailabilityInterface,
    private val graph: STDCMGraph,
    private val internalMargin:
        Double // Margin added to every occupancy, to account for binary search tolerance
) {
    /**
     * Returns one value per "opening" (interval between two unavailable times). Always returns the
     * shortest delay to add to enter this opening.
     */
    fun minimumDelaysPerOpening(
        infraExplorer: InfraExplorerWithEnvelope,
        startTime: Double,
        envelope: Envelope,
        startOffset: Offset<Block>,
        stopDurationAtEnd: Double?
    ): NavigableSet<Double> {
        val res = TreeSet<Double>()
        val endOffset = startOffset + fromMeters(envelope.endPos)
        var time = startTime
        while (java.lang.Double.isFinite(time)) {
            val availability =
                getScaledAvailability(
                    infraExplorer,
                    startOffset,
                    endOffset,
                    envelope,
                    time,
                    stopDurationAtEnd
                )
            time +=
                when (availability) {
                    is BlockAvailabilityInterface.Available -> {
                        if (availability.maximumDelay >= internalMargin) res.add(time - startTime)
                        availability.maximumDelay + internalMargin
                    }
                    is BlockAvailabilityInterface.Unavailable -> {
                        availability.duration + internalMargin * 2
                    }
                }
        }
        return res
    }

    /** Returns the start time of the next occupancy for the block */
    fun findNextOccupancy(
        infraExplorer: InfraExplorerWithEnvelope,
        time: Double,
        startOffset: Offset<Block>,
        envelope: Envelope,
        stopDurationAtEnd: Double?
    ): Double {
        val endOffset = startOffset + fromMeters(envelope.endPos)
        val availability =
            getScaledAvailability(
                infraExplorer,
                startOffset,
                endOffset,
                envelope,
                time,
                stopDurationAtEnd
            )
        assert(availability.javaClass == BlockAvailabilityInterface.Available::class.java)
        return (availability as BlockAvailabilityInterface.Available).timeOfNextConflict
    }

    /**
     * Returns true if the total run time at the start of the edge is above the specified threshold
     */
    fun isRunTimeTooLong(edge: STDCMEdge): Boolean {
        val totalRunTime = edge.timeStart - edge.totalDepartureTimeShift - minScheduleTimeStart
        // We could use the A* heuristic here, but it would break STDCM on any infra where the
        // coordinates don't match the actual distance (which is the case when generated).
        // Ideally we should add a switch in the railjson format
        return totalRunTime > maxRunTime
    }

    /**
     * Returns by how much we can shift this envelope (in time) before causing a conflict.
     *
     * e.g. if the train takes 42s to go through the block, enters the block at t=10s, and we need
     * to leave the block at t=60s, this will return 8s.
     */
    fun findMaximumAddedDelay(
        infraExplorer: InfraExplorerWithEnvelope,
        startTime: Double,
        startOffset: Offset<Block>,
        envelope: Envelope,
        stopDurationAtEnd: Double?
    ): Double {
        val endOffset = startOffset + fromMeters(envelope.endPos)
        val availability =
            getScaledAvailability(
                infraExplorer,
                startOffset,
                endOffset,
                envelope,
                startTime,
                stopDurationAtEnd
            )
        assert(availability is BlockAvailabilityInterface.Available)
        return (availability as BlockAvailabilityInterface.Available).maximumDelay - internalMargin
    }

    /**
     * Calls `blockAvailability.getAvailability`, on an envelope scaled to account for the standard
     * allowance.
     */
    private fun getScaledAvailability(
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Offset<Block>,
        endOffset: Offset<Block>,
        envelope: Envelope,
        startTime: Double,
        stopDurationAtEnd: Double?
    ): Availability {
        val speedRatio = graph.getStandardAllowanceSpeedRatio(envelope)
        val scaledEnvelope =
            if (envelope.endPos == 0.0) envelope
            else LinearAllowance.scaleEnvelope(envelope, speedRatio)
        val envelopeWithStop =
            if (stopDurationAtEnd == null) scaledEnvelope
            else
                EnvelopeStopWrapper(
                    scaledEnvelope,
                    listOf(TrainStop(envelope.endPos, stopDurationAtEnd))
                )
        val explorerWithNewEnvelope = infraExplorer.clone().addEnvelope(envelopeWithStop)
        val startOffsetOnPath =
            startOffset + explorerWithNewEnvelope.getPredecessorLength().distance
        val endOffsetOnPath = startOffsetOnPath + (endOffset - startOffset)
        return blockAvailability.getAvailability(
            explorerWithNewEnvelope,
            startOffsetOnPath.cast(),
            endOffsetOnPath.cast(),
            startTime
        )
    }
}
