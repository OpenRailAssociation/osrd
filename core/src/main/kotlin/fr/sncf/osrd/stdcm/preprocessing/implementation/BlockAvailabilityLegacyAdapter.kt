package fr.sncf.osrd.stdcm.preprocessing.implementation

import com.google.common.collect.Multimap
import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.stdcm.OccupancySegment
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface.Availability
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Distance.Companion.max
import fr.sncf.osrd.utils.units.Distance.Companion.min
import fr.sncf.osrd.utils.units.meters
import java.lang.Double.isFinite

/**
 * This class implements the BlockAvailabilityInterface using the legacy block occupancy data. It's
 * meant to be removed once STDCM is fully integrated with the conflict detection module.
 */
class BlockAvailabilityLegacyAdapter
/** Constructor */
(
    private val blockInfra: BlockInfra,
    private val unavailableSpace: Multimap<BlockId, OccupancySegment>
) : BlockAvailabilityInterface {
    override fun getAvailability(
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Distance,
        endOffset: Distance,
        startTime: Double
    ): Availability {
        val envelope = infraExplorer.getLastEnvelope()
        val block = infraExplorer.getCurrentBlock()
        assert(
            TrainPhysicsIntegrator.arePositionsEqual(
                (endOffset - startOffset).meters,
                envelope.endPos
            )
        )
        val unavailability = findMinimumDelay(block, startOffset, endOffset, envelope, startTime)
        return unavailability ?: findMaximumDelay(block, startOffset, envelope, startTime)
    }

    /**
     * Find the minimum delay needed to avoid any conflict. Returns 0 if the train isn't currently
     * causing any conflict.
     */
    private fun findMinimumDelay(
        block: BlockId,
        startOffset: Distance,
        endOffset: Distance,
        envelope: EnvelopeTimeInterpolate,
        startTime: Double
    ): BlockAvailabilityInterface.Unavailable? {
        var minimumDelay = 0.0
        var conflictOffset = 0.meters
        for (unavailableSegment in unavailableSpace[block]) {
            val trainInBlock =
                getTimeTrainInBlock(unavailableSegment, startOffset, envelope, startTime)
                    ?: continue
            if (
                trainInBlock.start < unavailableSegment.timeEnd &&
                    trainInBlock.end > unavailableSegment.timeStart
            ) {
                val blockMinimumDelay = unavailableSegment.timeEnd - trainInBlock.start
                if (blockMinimumDelay > minimumDelay) {
                    minimumDelay = blockMinimumDelay
                    conflictOffset =
                        if (trainInBlock.start <= unavailableSegment.timeStart) {
                            // The train enters the block before it's unavailable: conflict at end
                            // location
                            unavailableSegment.distanceEnd
                        } else {
                            // The train enters the block when it's already unavailable: conflict at
                            // start location
                            unavailableSegment.distanceStart
                        }
                }
            }
        }
        if (minimumDelay == 0.0) return null
        if (isFinite(minimumDelay)) {
            // We need to add delay, a recursive call is needed to detect new conflicts
            // that may appear with the added delay
            val recursiveDelay =
                findMinimumDelay(block, startOffset, endOffset, envelope, startTime + minimumDelay)
            if (
                recursiveDelay != null
            ) // The recursive call returns null if there is no new conflict
             minimumDelay += recursiveDelay.duration
        }
        val pathLength = blockInfra.getBlockLength(block)
        conflictOffset = max(0.meters, min(pathLength.distance, conflictOffset))
        return BlockAvailabilityInterface.Unavailable(minimumDelay, conflictOffset)
    }

    /**
     * Find the maximum amount of delay that can be added to the train without causing conflict.
     * Cannot be called if the train is currently causing a conflict.
     */
    private fun findMaximumDelay(
        block: BlockId,
        startOffset: Distance,
        envelope: EnvelopeTimeInterpolate,
        startTime: Double
    ): BlockAvailabilityInterface.Available {
        var maximumDelay = Double.POSITIVE_INFINITY
        var timeOfNextOccupancy = Double.POSITIVE_INFINITY
        for (segment in unavailableSpace[block]) {
            val timeTrainInBlock = getTimeTrainInBlock(segment, startOffset, envelope, startTime)
            if (timeTrainInBlock == null || timeTrainInBlock.start >= segment.timeEnd)
                continue // The block is occupied before we enter it
            assert(timeTrainInBlock.start <= segment.timeStart)
            val maxDelayForBlock = segment.timeStart - timeTrainInBlock.end
            if (maxDelayForBlock < maximumDelay) {
                maximumDelay = maxDelayForBlock
                timeOfNextOccupancy = segment.timeStart
            }
        }
        return BlockAvailabilityInterface.Available(maximumDelay, timeOfNextOccupancy)
    }

    private class TimeInterval(val start: Double, val end: Double)

    /** Returns the time interval during which the train is on the given blocK. */
    private fun getTimeTrainInBlock(
        unavailableSegment: OccupancySegment,
        startOffset: Distance,
        envelope: EnvelopeTimeInterpolate,
        startTime: Double
    ): TimeInterval? {
        val startBlockOffsetOnEnvelope = -startOffset
        // Offsets on the envelope
        val blockEnterOffset =
            (startBlockOffsetOnEnvelope + unavailableSegment.distanceStart).meters
        val blockExitOffset = (startBlockOffsetOnEnvelope + unavailableSegment.distanceEnd).meters
        if (blockEnterOffset > envelope.endPos || blockExitOffset < 0) return null
        val enterTime = startTime + envelope.interpolateTotalTimeClamp(blockEnterOffset)
        val exitTime = startTime + envelope.interpolateTotalTimeClamp(blockExitOffset)
        return TimeInterval(enterTime, exitTime)
    }
}
