package fr.sncf.osrd.stdcm.preprocessing

import com.google.common.collect.Multimap
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

/**
 * This class is used for tests, when we want to define when each block is available without having
 * to manage actual signaling. The "unavailable space" is a collection of time intervals that are
 * unavailable for a given block.
 *
 * It is fairly complex for a dummy test class, it's an adaptation of what we had before the actual
 * signaling integration. Being able to test STDCM without directly dealing with the signaling
 * systems has immensely helped with testing, so we kept the class for that purpose.
 */
class DummyBlockAvailability(
    private val blockInfra: BlockInfra,
    private val unavailableSpace: Multimap<BlockId, OccupancySegment>
) : BlockAvailabilityInterface {
    /**
     * Simple record used to group together a block and the offset of its start on the given path
     */
    private data class BlockWithOffset(val blockId: BlockId, val pathOffset: Distance)

    private data class ResourceUse(
        val startOffset: Offset<Path>,
        val endOffset: Offset<Path>,
        val startTime: Double,
        val endTime: Double,
        val blockId: BlockId,
    )

    /** Returns all resource usage for the given path, or null if more lookahead is needed */
    private fun generateResourcesForPath(
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Offset<Path>,
        endOffset: Offset<Path>,
    ): List<ResourceUse> {
        val blocks = makeBlocksWithOffsets(infraExplorer)
        val res = mutableListOf<ResourceUse>()
        for (blockWithOffset in getBlocksInRange(blocks, startOffset, endOffset)) {
            for (unavailableSegment in unavailableSpace[blockWithOffset.blockId]) {
                val trainInBlock =
                    getTimeTrainInBlock(
                        unavailableSegment,
                        blockWithOffset,
                        infraExplorer,
                        startOffset,
                        endOffset
                    ) ?: continue
                val segmentStartOffset =
                    Offset<Path>(blockWithOffset.pathOffset + unavailableSegment.distanceStart)
                val segmentEndOffset =
                    Offset<Path>(blockWithOffset.pathOffset + unavailableSegment.distanceEnd)
                res.add(
                    ResourceUse(
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
    private fun getScheduledResources(
        infraExplorer: InfraExplorerWithEnvelope,
        resource: ResourceUse
    ): List<ResourceUse>? {
        val blocks = makeBlocksWithOffsets(infraExplorer)
        val res = mutableListOf<ResourceUse>()
        for (segment in unavailableSpace[resource.blockId]) {
            // Can be optimized
            val blockOffset =
                Offset<Path>(blocks.first { it.blockId == resource.blockId }.pathOffset)
            if (segment.enabledIfBlockInLookahead != null) {
                val lookahead = infraExplorer.getLookahead()
                if (lookahead.contains(segment.disabledIfBlockInLookahead)) continue
                if (!lookahead.contains(segment.enabledIfBlockInLookahead)) {
                    if (!infraExplorer.getIncrementalPath().pathComplete)
                        return null // Can't determine the resource use
                    else continue
                }
            }
            res.add(
                ResourceUse(
                    blockOffset + segment.distanceStart,
                    blockOffset + segment.distanceEnd,
                    segment.timeStart,
                    segment.timeEnd,
                    resource.blockId
                )
            )
        }
        return res
    }

    override fun getAvailability(
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Offset<Path>,
        endOffset: Offset<Path>,
        startTime: Double
    ): BlockAvailabilityInterface.Availability {
        val resourceUses = generateResourcesForPath(infraExplorer, startOffset, endOffset)
        // startTime refers to the time at startOffset, we need to offset it
        val pathStartTime = startTime - infraExplorer.interpolateTimeClamp(startOffset)
        val unavailability =
            findMinimumDelay(infraExplorer, resourceUses, pathStartTime, startOffset)
        return unavailability ?: findMaximumDelay(infraExplorer, resourceUses, pathStartTime)
    }

    /**
     * Find the minimum delay needed to avoid any conflict. Returns 0 if the train isn't currently
     * causing any conflict.
     */
    private fun findMinimumDelay(
        infraExplorer: InfraExplorerWithEnvelope,
        resourceUses: List<ResourceUse>,
        pathStartTime: Double,
        startOffset: Offset<Path>
    ): BlockAvailabilityInterface.Unavailable? {
        var minimumDelay = 0.0
        var conflictOffset = Offset<Path>(0.meters)
        for (resourceUse in resourceUses) {
            val resourceStartTime = resourceUse.startTime + pathStartTime
            val resourceEndTime = resourceUse.endTime + pathStartTime
            for (scheduledResourceUse in getScheduledResourcesOrThrow(infraExplorer, resourceUse)) {
                if (
                    resourceStartTime > scheduledResourceUse.endTime ||
                        resourceEndTime < scheduledResourceUse.startTime
                )
                    continue
                val resourceMinimumDelay = scheduledResourceUse.endTime - resourceStartTime
                if (resourceMinimumDelay > minimumDelay) {
                    minimumDelay = resourceMinimumDelay
                    conflictOffset =
                        if (resourceStartTime <= scheduledResourceUse.startTime) {
                            // The train enters the block before it's unavailable: conflict at end
                            // location
                            resourceUse.endOffset
                        } else {
                            // The train enters the block when it's already unavailable: conflict at
                            // start location
                            resourceUse.startOffset
                        }
                }
            }
        }
        if (minimumDelay == 0.0) return null
        if (java.lang.Double.isFinite(minimumDelay)) {
            // We need to add delay, a recursive call is needed to detect new conflicts
            // that may appear with the added delay
            val recursiveDelay =
                findMinimumDelay(
                    infraExplorer,
                    resourceUses,
                    pathStartTime + minimumDelay,
                    startOffset
                )
            if (
                recursiveDelay != null
            ) // The recursive call returns null if there is no new conflict
             minimumDelay += recursiveDelay.duration
        }
        val conflictTravelledOffset = conflictOffset - startOffset.distance
        return BlockAvailabilityInterface.Unavailable(minimumDelay, conflictTravelledOffset.cast())
    }

    /**
     * Find the maximum amount of delay that can be added to the train without causing conflict.
     * Cannot be called if the train is currently causing a conflict.
     */
    private fun findMaximumDelay(
        infraExplorer: InfraExplorerWithEnvelope,
        resourceUses: List<ResourceUse>,
        pathStartTime: Double,
    ): BlockAvailabilityInterface.Available {
        var maximumDelay = Double.POSITIVE_INFINITY
        var timeOfNextOccupancy = Double.POSITIVE_INFINITY
        for (resourceUse in resourceUses) {
            val resourceStartTime = resourceUse.startTime + pathStartTime
            val resourceEndTime = resourceUse.endTime + pathStartTime
            for (scheduledResourceUse in getScheduledResourcesOrThrow(infraExplorer, resourceUse)) {
                if (resourceStartTime >= scheduledResourceUse.endTime)
                    continue // The block is occupied before we enter it
                assert(resourceStartTime <= scheduledResourceUse.startTime)
                val maxDelayForBlock = scheduledResourceUse.startTime - resourceEndTime
                if (maxDelayForBlock < maximumDelay) {
                    maximumDelay = maxDelayForBlock
                    timeOfNextOccupancy = scheduledResourceUse.startTime
                }
            }
        }
        return BlockAvailabilityInterface.Available(maximumDelay, timeOfNextOccupancy)
    }

    private fun getScheduledResourcesOrThrow(
        infraExplorer: InfraExplorerWithEnvelope,
        resource: ResourceUse
    ): List<ResourceUse> {
        return getScheduledResources(infraExplorer, resource)
            ?: throw BlockAvailabilityInterface.NotEnoughLookaheadError()
    }

    /** Create pairs of (block, offset) */
    private fun makeBlocksWithOffsets(infraExplorer: InfraExplorer): List<BlockWithOffset> {
        var offset = 0.meters
        val res = ArrayList<BlockWithOffset>()
        for (block in infraExplorer.getPredecessorBlocks().toList()) {
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
        explorer: InfraExplorerWithEnvelope,
        startOffset: Offset<Path>,
        endOffset: Offset<Path>
    ): TimeInterval? {
        val blockEnterOffset = (block.pathOffset + unavailableSegment.distanceStart)
        val blockExitOffset = (block.pathOffset + unavailableSegment.distanceEnd)
        if (startOffset.distance > blockExitOffset || endOffset.distance < blockEnterOffset)
            return null

        val enterTime = explorer.interpolateTimeClamp(Offset(blockEnterOffset))
        val exitTime = explorer.interpolateTimeClamp(Offset(blockExitOffset))
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
