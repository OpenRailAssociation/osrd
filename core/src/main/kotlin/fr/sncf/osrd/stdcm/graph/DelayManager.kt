package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface.Availability
import fr.sncf.osrd.utils.units.Distance.Companion.fromMeters
import fr.sncf.osrd.utils.units.Offset
import java.util.*

/** This class contains all the methods used to handle delays
 * (how much we can add, how much we need to add, and such)
 */
class DelayManager internal constructor(
    private val minScheduleTimeStart: Double,
    private val maxRunTime: Double,
    private val blockAvailability: BlockAvailabilityInterface,
    private val graph: STDCMGraph
) {
    /** Returns one value per "opening" (interval between two unavailable times).
     * Always returns the shortest delay to add to enter this opening.  */
    fun minimumDelaysPerOpening(
        blockId: BlockId,
        startTime: Double,
        envelope: Envelope,
        startOffset: Offset<Block>
    ): NavigableSet<Double> {
        // This is the margin used for the binary search, we need to add
        // this time before and after the train to avoid problems caused by the error margin
        val margin = graph.timeStep
        val res = TreeSet<Double>()
        val endOffset = startOffset + fromMeters(envelope.endPos)
        var time = startTime
        while (java.lang.Double.isFinite(time)) {
            val availability = getScaledAvailability(
                blockId,
                startOffset,
                endOffset,
                envelope,
                time
            )
            time += when (availability) {
                is BlockAvailabilityInterface.Available -> {
                    if (availability.maximumDelay >= margin)
                        res.add(time - startTime)
                    availability.maximumDelay + 1
                }

                is BlockAvailabilityInterface.Unavailable -> {
                    availability.duration + margin
                }

                else -> throw OSRDError(ErrorType.InvalidSTDCMDelayError)
            }
        }
        return res
    }

    /** Returns the start time of the next occupancy for the block  */
    fun findNextOccupancy(blockId: BlockId, time: Double, startOffset: Offset<Block>, envelope: Envelope): Double {
        val endOffset = startOffset + fromMeters(envelope.endPos)
        val availability = getScaledAvailability(
            blockId,
            startOffset,
            endOffset,
            envelope,
            time
        )
        assert(availability.javaClass == BlockAvailabilityInterface.Available::class.java)
        return (availability as BlockAvailabilityInterface.Available).timeOfNextConflict
    }

    /** Returns true if the total run time at the start of the edge is above the specified threshold  */
    fun isRunTimeTooLong(edge: STDCMEdge): Boolean {
        val totalRunTime = edge.timeStart - edge.totalDepartureTimeShift - minScheduleTimeStart
        // We could use the A* heuristic here, but it would break STDCM on any infra where the
        // coordinates don't match the actual distance (which is the case when generated).
        // Ideally we should add a switch in the railjson format
        return totalRunTime > maxRunTime
    }

    /** Returns by how much we can shift this envelope (in time) before causing a conflict.
     *
     * e.g. if the train takes 42s to go through the block, enters the block at t=10s,
     * and we need to leave the block at t=60s, this will return 8s.  */
    fun findMaximumAddedDelay(
        blockId: BlockId,
        startTime: Double,
        startOffset: Offset<Block>,
        envelope: Envelope
    ): Double {
        val endOffset = startOffset + fromMeters(envelope.endPos)
        val availability = getScaledAvailability(
            blockId, startOffset, endOffset, envelope, startTime
        )
        assert(availability is BlockAvailabilityInterface.Available)
        return (availability as BlockAvailabilityInterface.Available).maximumDelay
    }

    /** Calls `blockAvailability.getAvailability`, on an envelope scaled to account for the standard allowance.  */
    private fun getScaledAvailability(
        blockId: BlockId,
        startOffset: Offset<Block>,
        endOffset: Offset<Block>,
        envelope: Envelope,
        startTime: Double
    ): Availability {
        val speedRatio = graph.getStandardAllowanceSpeedRatio(envelope)
        val scaledEnvelope =
            if (envelope.endPos == 0.0)
                envelope
            else
                LinearAllowance.scaleEnvelope(envelope, speedRatio)
        return blockAvailability.getAvailability(
            listOf(blockId),
            startOffset.distance,
            endOffset.distance,
            scaledEnvelope,
            startTime
        )
    }
}
