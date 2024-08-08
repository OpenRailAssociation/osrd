package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface.Availability
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
        infraExplorerWithNewEnvelope: InfraExplorerWithEnvelope,
        startTime: Double,
        envelope: Envelope,
        startOffset: Offset<Block>,
    ): NavigableSet<Double> {
        val res = TreeSet<Double>()
        val endOffset = startOffset + fromMeters(envelope.endPos)
        var time = startTime
        while (java.lang.Double.isFinite(time)) {
            val availability =
                getLastBlockAvailability(
                    infraExplorerWithNewEnvelope,
                    startOffset,
                    endOffset,
                    time,
                )
            time +=
                when (availability) {
                    is BlockAvailabilityInterface.Available -> {
                        if (availability.maximumDelay >= internalMargin) res.add(time - startTime)
                        availability.maximumDelay + internalMargin
                    }
                    is BlockAvailabilityInterface.Unavailable -> {
                        availability.duration + internalMargin
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
    ): Double {
        val endOffset = startOffset + fromMeters(envelope.endPos)
        val availability =
            getLastBlockAvailability(
                infraExplorer,
                startOffset,
                endOffset,
                time,
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
        infraExplorerWithNewEnvelope: InfraExplorerWithEnvelope,
        startTime: Double,
        startOffset: Offset<Block>,
        envelope: Envelope,
    ): Double {
        val endOffset = startOffset + fromMeters(envelope.endPos)
        val availability =
            getLastBlockAvailability(
                infraExplorerWithNewEnvelope,
                startOffset,
                endOffset,
                startTime,
            )
        assert(availability is BlockAvailabilityInterface.Available)
        return (availability as BlockAvailabilityInterface.Available).maximumDelay - internalMargin
    }

    /**
     * Calls `blockAvailability.getAvailability` on the last block. This accounts for the standard
     * allowance, as the envelopes in the infra explorer are scaled accordingly.
     */
    private fun getLastBlockAvailability(
        explorerWithNewEnvelope: InfraExplorerWithEnvelope,
        startOffset: Offset<Block>,
        endOffset: Offset<Block>,
        startTime: Double,
    ): Availability {
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
