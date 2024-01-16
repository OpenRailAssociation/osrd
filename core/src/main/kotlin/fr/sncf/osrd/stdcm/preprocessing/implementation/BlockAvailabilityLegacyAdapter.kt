package fr.sncf.osrd.stdcm.preprocessing.implementation

import com.google.common.collect.Multimap
import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.stdcm.OccupancySegment
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

/**
 * This class implements the BlockAvailabilityInterface using the legacy block occupancy data. It's
 * meant to be moved to test modules once STDCM is fully integrated with the conflict detection
 * module.
 */
class BlockAvailabilityLegacyAdapter(
    private val blockInfra: BlockInfra,
    private val unavailableSpace: Multimap<BlockId, OccupancySegment>
) : GenericBlockAvailability() {
    /**
     * Simple record used to group together a block and the offset of its start on the given path
     */
    private data class BlockWithOffset(val blockId: BlockId, val pathOffset: Distance)

    private data class BlockResourceUse(
        override val startOffset: Offset<Path>,
        override val endOffset: Offset<Path>,
        override val startTime: Double,
        override val endTime: Double,
        val blockId: BlockId,
    ) : ResourceUse

    /** Returns all resource usage for the given path */
    override fun generateResourcesForPath(
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Offset<Path>,
        endOffset: Offset<Path>,
    ): List<ResourceUse> {
        val envelope = infraExplorer.getFullEnvelope()
        val blocks = makeBlocksWithOffsets(infraExplorer)
        val res = mutableListOf<ResourceUse>()
        for (blockWithOffset in getBlocksInRange(blocks, startOffset, endOffset)) {
            for (unavailableSegment in unavailableSpace[blockWithOffset.blockId]) {
                val trainInBlock =
                    getTimeTrainInBlock(
                        unavailableSegment,
                        blockWithOffset,
                        envelope,
                        startOffset,
                        endOffset
                    ) ?: continue
                val segmentStartOffset =
                    Offset<Path>(blockWithOffset.pathOffset + unavailableSegment.distanceStart)
                val segmentEndOffset =
                    Offset<Path>(blockWithOffset.pathOffset + unavailableSegment.distanceStart)
                res.add(
                    BlockResourceUse(
                        segmentStartOffset,
                        segmentEndOffset,
                        trainInBlock.start,
                        trainInBlock.end,
                        blockWithOffset.blockId
                    )
                )
            }
        }
        return res
    }

    /**
     * Returns all the scheduled resource use that use the same resource as the one given as
     * parameter
     */
    override fun getScheduledResources(
        infraExplorer: InfraExplorerWithEnvelope,
        resource: ResourceUse
    ): List<ResourceUse> {
        val blocks = makeBlocksWithOffsets(infraExplorer)
        val blockUse = resource as BlockResourceUse
        val res = mutableListOf<ResourceUse>()
        for (segment in unavailableSpace[blockUse.blockId]) {
            // Can be optimized
            val blockOffset =
                Offset<Path>(blocks.first { it.blockId == blockUse.blockId }.pathOffset)
            res.add(
                BlockResourceUse(
                    blockOffset + segment.distanceStart,
                    blockOffset + segment.distanceEnd,
                    segment.timeStart,
                    segment.timeEnd,
                    blockUse.blockId
                )
            )
        }
        return res
    }

    /** Create pairs of (block, offset) */
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

    private class TimeInterval(val start: Double, val end: Double)

    /** Returns the time interval during which the train is on the given blocK. */
    private fun getTimeTrainInBlock(
        unavailableSegment: OccupancySegment,
        block: BlockWithOffset,
        envelope: EnvelopeTimeInterpolate,
        startOffset: Offset<Path>,
        endOffset: Offset<Path>
    ): TimeInterval? {
        val blockEnterOffset = (block.pathOffset + unavailableSegment.distanceStart)
        val blockExitOffset = (block.pathOffset + unavailableSegment.distanceEnd)
        if (startOffset.distance > blockExitOffset || endOffset.distance < blockEnterOffset)
            return null

        // startTime refers to the time at startOffset, we need to offset it when interpolating on
        // the envelope
        // val envelopeStartTime = startTime -
        // envelope.interpolateTotalTimeClamp(startOffset.meters)

        val enterTime = envelope.interpolateTotalTimeClamp(blockEnterOffset.meters)
        val exitTime = envelope.interpolateTotalTimeClamp(blockExitOffset.meters)
        return TimeInterval(enterTime, exitTime)
    }

    /** Returns the list of blocks in the given interval on the path */
    private fun getBlocksInRange(
        blocks: List<BlockWithOffset>,
        start: Offset<Path>,
        end: Offset<Path>
    ): List<BlockWithOffset> {
        return blocks
            .stream()
            .filter { (_, pathOffset): BlockWithOffset -> pathOffset < end.distance }
            .filter { (blockId, pathOffset): BlockWithOffset ->
                pathOffset + blockInfra.getBlockLength(blockId).distance > start.distance
            }
            .toList()
    }
}
