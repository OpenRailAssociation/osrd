package fr.sncf.osrd.stdcm.preprocessing.implementation

import com.google.common.collect.Multimap
import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.stdcm.OccupancySegment
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface.Availability
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Distance.Companion.max
import fr.sncf.osrd.utils.units.Distance.Companion.min
import fr.sncf.osrd.utils.units.meters
import java.lang.Double.isFinite

/** This class implements the BlockAvailabilityInterface using the legacy block occupancy data.
 * It's meant to be moved to test modules once STDCM is fully integrated with the conflict detection module. */
class BlockAvailabilityLegacyAdapter
    (
    private val blockInfra: BlockInfra,
    private val unavailableSpace: Multimap<BlockId, OccupancySegment>
) : BlockAvailabilityInterface {
    /** Simple record used to group together a block and the offset of its start on the given path  */
    @JvmRecord
    private data class BlockWithOffset(val blockId: BlockId, val pathOffset: Distance)

    override fun getAvailability(
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Distance,
        endOffset: Distance,
        startTime: Double
    ): Availability {
        val envelope = infraExplorer.getFullEnvelope()
        val blocksWithOffsets = makeBlocksWithOffsets(infraExplorer)
        val unavailability = findMinimumDelay(blocksWithOffsets, startOffset, endOffset, envelope, startTime)
        return unavailability
            ?: findMaximumDelay(
                blocksWithOffsets,
                startOffset,
                endOffset,
                envelope,
                startTime
            )
    }

    /** Create pairs of (block, offset)  */
    private fun makeBlocksWithOffsets(infraExplorer: InfraExplorer): List<BlockWithOffset> {
        var offset = 0.meters
        val res = ArrayList<BlockWithOffset>()
        for (block in infraExplorer.getPredecessorBlocks()) {
            val length = blockInfra.getBlockLength(block)
            res.add(BlockWithOffset(block, offset))
            offset += length.distance
        }
        res.add(BlockWithOffset(infraExplorer.getCurrentBlock(), offset))
        return res
    }

    /** Find the minimum delay needed to avoid any conflict.
     * Returns 0 if the train isn't currently causing any conflict.  */
    private fun findMinimumDelay(
        blocks: List<BlockWithOffset>,
        startOffset: Distance,
        endOffset: Distance,
        envelope: EnvelopeTimeInterpolate,
        startTime: Double
    ): BlockAvailabilityInterface.Unavailable? {
        var minimumDelay = 0.0
        var conflictOffset = 0.meters
        for (blockWithOffset in getBlocksInRange(blocks, startOffset, endOffset)) {
            for (unavailableSegment in unavailableSpace[blockWithOffset.blockId]) {
                val trainInBlock = getTimeTrainInBlock(
                    unavailableSegment,
                    blockWithOffset,
                    envelope,
                    startTime,
                    startOffset,
                    endOffset
                ) ?: continue
                if (trainInBlock.start < unavailableSegment.timeEnd
                    && trainInBlock.end > unavailableSegment.timeStart
                ) {
                    val blockMinimumDelay = unavailableSegment.timeEnd - trainInBlock.start
                    if (blockMinimumDelay > minimumDelay) {
                        minimumDelay = blockMinimumDelay
                        conflictOffset = if (trainInBlock.start <= unavailableSegment.timeStart) {
                            // The train enters the block before it's unavailable: conflict at end location
                            blockWithOffset.pathOffset + unavailableSegment.distanceEnd
                        } else {
                            // The train enters the block when it's already unavailable: conflict at start location
                            blockWithOffset.pathOffset + unavailableSegment.distanceStart
                        }
                    }
                }
            }
        }
        if (minimumDelay == 0.0)
            return null
        if (isFinite(minimumDelay)) {
            // We need to add delay, a recursive call is needed to detect new conflicts
            // that may appear with the added delay
            val recursiveDelay = findMinimumDelay(blocks, startOffset, endOffset, envelope, startTime + minimumDelay)
            if (recursiveDelay != null) // The recursive call returns null if there is no new conflict
                minimumDelay += recursiveDelay.duration
        }
        conflictOffset = max(startOffset, min(endOffset, conflictOffset))
        return BlockAvailabilityInterface.Unavailable(minimumDelay, conflictOffset)
    }

    /** Find the maximum amount of delay that can be added to the train without causing conflict.
     * Cannot be called if the train is currently causing a conflict.  */
    private fun findMaximumDelay(
        blocks: List<BlockWithOffset>,
        startOffset: Distance,
        endOffset: Distance,
        envelope: EnvelopeTimeInterpolate,
        startTime: Double
    ): BlockAvailabilityInterface.Available {
        var maximumDelay = Double.POSITIVE_INFINITY
        var timeOfNextOccupancy = Double.POSITIVE_INFINITY
        for (blockWithOffset in getBlocksInRange(blocks, startOffset, endOffset)) {
            for (block in unavailableSpace[blockWithOffset.blockId]) {
                val timeTrainInBlock = getTimeTrainInBlock(
                    block,
                    blockWithOffset,
                    envelope,
                    startTime,
                    startOffset,
                    endOffset
                )
                if (timeTrainInBlock == null || timeTrainInBlock.start >= block.timeEnd)
                    continue // The block is occupied before we enter it
                assert(timeTrainInBlock.start <= block.timeStart)
                val maxDelayForBlock = block.timeStart - timeTrainInBlock.end
                if (maxDelayForBlock < maximumDelay) {
                    maximumDelay = maxDelayForBlock
                    timeOfNextOccupancy = block.timeStart
                }
            }
        }
        return BlockAvailabilityInterface.Available(maximumDelay, timeOfNextOccupancy)
    }

    /** Returns the list of blocks in the given interval on the path  */
    private fun getBlocksInRange(
        blocks: List<BlockWithOffset>,
        start: Distance,
        end: Distance
    ): List<BlockWithOffset> {
        return blocks.stream()
            .filter { (_, pathOffset): BlockWithOffset -> pathOffset < end }
            .filter { (blockId, pathOffset): BlockWithOffset ->
                pathOffset + blockInfra.getBlockLength(blockId).distance > start
            }
            .toList()
    }

    private class TimeInterval(val start: Double, val end: Double)

    /** Returns the time interval during which the train is on the given blocK.  */
    private fun getTimeTrainInBlock(
        unavailableSegment: OccupancySegment,
        block: BlockWithOffset,
        envelope: EnvelopeTimeInterpolate,
        startTime: Double,
        startOffset: Distance,
        endOffset: Distance
    ): TimeInterval? {
        val blockEnterOffset = (block.pathOffset + unavailableSegment.distanceStart)
        val blockExitOffset = (block.pathOffset + unavailableSegment.distanceEnd)
        if (startOffset > blockExitOffset || endOffset < blockEnterOffset)
            return null

        // startTime refers to the time at startOffset, we need to offset it when interpolating on the envelope
        val envelopeStartTime = startTime - envelope.interpolateTotalTimeClamp(startOffset.meters)

        val enterTime = envelopeStartTime + envelope.interpolateTotalTimeClamp(blockEnterOffset.meters)
        val exitTime = envelopeStartTime + envelope.interpolateTotalTimeClamp(blockExitOffset.meters)
        return TimeInterval(enterTime, exitTime)
    }
}
