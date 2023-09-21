package fr.sncf.osrd.stdcm.preprocessing.implementation;

import com.google.common.collect.Multimap;
import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate;
import fr.sncf.osrd.sim_infra.api.BlockInfra;
import fr.sncf.osrd.stdcm.OccupancySegment;
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface;
import fr.sncf.osrd.utils.units.Distance;
import java.util.ArrayList;
import java.util.List;

/** This class implements the BlockAvailabilityInterface using the legacy block occupancy data.
 * It's meant to be removed once STDCM is plugged to the conflict detection module. */
public class BlockAvailabilityLegacyAdapter implements BlockAvailabilityInterface {

    private final BlockInfra blockInfra;
    private final Multimap<Integer, OccupancySegment> unavailableSpace; // keys are block ids

    /** Simple record used to group together a block and the offset of its start on the given path */
    private record BlockWithOffset(
            Integer blockID,
            Long pathOffset
    ){}

    /** Constructor */
    public BlockAvailabilityLegacyAdapter(
            BlockInfra blockInfra,
            Multimap<Integer, OccupancySegment> unavailableSpace
    ) {
        this.blockInfra = blockInfra;
        this.unavailableSpace = unavailableSpace;
    }

    @Override
    public Availability getAvailability(
            List<Integer> blocks,
            long startOffset,
            long endOffset,
            EnvelopeTimeInterpolate envelope,
            double startTime
    ) {
        assert Math.abs(Distance.toMeters(endOffset - startOffset) - envelope.getEndPos()) < 1e-5;
        var blocksWithOffsets = makeBlocksWithOffsets(blocks);
        var unavailability = findMinimumDelay(blocksWithOffsets, startOffset, endOffset, envelope, startTime);
        if (unavailability != null)
            return unavailability;
        return findMaximumDelay(blocksWithOffsets, startOffset, endOffset, envelope, startTime);
    }

    /** Create pairs of (block, offset) */
    private List<BlockWithOffset> makeBlocksWithOffsets(List<Integer> blocks) {
        long offset = 0;
        var res = new ArrayList<BlockWithOffset>();
        for (var block : blocks) {
            var length = blockInfra.getBlockLength(block);
            res.add(new BlockWithOffset(block, offset));
            offset += length;
        }
        return res;
    }

    /** Find the minimum delay needed to avoid any conflict.
     * Returns 0 if the train isn't currently causing any conflict. */
    Unavailable findMinimumDelay(
            List<BlockWithOffset> blocks,
            long startOffset,
            long endOffset,
            EnvelopeTimeInterpolate envelope,
            double startTime
    ) {
        double minimumDelay = 0;
        long conflictOffset = 0;
        for (var blockWithOffset : getBlocksInRange(blocks, startOffset, endOffset)) {
            for (var unavailableSegment : unavailableSpace.get(blockWithOffset.blockID)) {
                var trainInBlock = getTimeTrainInBlock(
                        unavailableSegment,
                        blockWithOffset,
                        startOffset,
                        envelope,
                        startTime
                );
                if (trainInBlock == null)
                    continue;
                if (trainInBlock.start < unavailableSegment.timeEnd()
                        && trainInBlock.end > unavailableSegment.timeStart()) {
                    var blockMinimumDelay = unavailableSegment.timeEnd() - trainInBlock.start;
                    if (blockMinimumDelay > minimumDelay) {
                        minimumDelay = blockMinimumDelay;
                        if (trainInBlock.start <= unavailableSegment.timeStart()) {
                            // The train enters the block before it's unavailable: conflict at end location
                            conflictOffset = blockWithOffset.pathOffset() + unavailableSegment.distanceEnd();
                        } else {
                            // The train enters the block when it's already unavailable: conflict at start location
                            conflictOffset = blockWithOffset.pathOffset() + unavailableSegment.distanceStart();
                        }
                    }
                }
            }
        }
        if (minimumDelay == 0)
            return null;
        if (Double.isFinite(minimumDelay)) {
            // We need to add delay, a recursive call is needed to detect new conflicts
            // that may appear with the added delay
            var recursiveDelay = findMinimumDelay(blocks, startOffset, endOffset, envelope, startTime + minimumDelay);
            if (recursiveDelay != null) // The recursive call returns null if there is no new conflict
                minimumDelay += recursiveDelay.duration;
        }
        var pathLength = blocks.stream()
                .mapToLong(block -> blockInfra.getBlockLength(block.blockID))
                .sum();
        conflictOffset = Math.max(0, Math.min(pathLength, conflictOffset));
        return new Unavailable(minimumDelay, conflictOffset);
    }

    /** Find the maximum amount of delay that can be added to the train without causing conflict.
     * Cannot be called if the train is currently causing a conflict. */
    Available findMaximumDelay(
            List<BlockWithOffset> blocks,
            long startOffset,
            long endOffset,
            EnvelopeTimeInterpolate envelope,
            double startTime
    ) {
        double maximumDelay = Double.POSITIVE_INFINITY;
        double timeOfNextOccupancy = Double.POSITIVE_INFINITY;
        for (var blockWithOffset : getBlocksInRange(blocks, startOffset, endOffset)) {
            for (var block : unavailableSpace.get(blockWithOffset.blockID)) {
                var timeTrainInBlock = getTimeTrainInBlock(
                        block,
                        blockWithOffset,
                        startOffset,
                        envelope,
                        startTime
                );
                if (timeTrainInBlock == null || timeTrainInBlock.start >= block.timeEnd())
                    continue; // The block is occupied before we enter it
                assert timeTrainInBlock.start <= block.timeStart();
                var maxDelayForBlock = block.timeStart() - timeTrainInBlock.end;
                if (maxDelayForBlock < maximumDelay) {
                    maximumDelay = maxDelayForBlock;
                    timeOfNextOccupancy = block.timeStart();
                }
            }
        }
        return new Available(maximumDelay, timeOfNextOccupancy);
    }

    /** Returns the list of blocks in the given interval on the path */
    private List<BlockWithOffset> getBlocksInRange(
            List<BlockWithOffset> blocks,
            long start,
            long end
    ) {
        return blocks.stream()
                .filter(r -> r.pathOffset() < end)
                .filter(r ->
                        r.pathOffset() + blockInfra.getBlockLength(r.blockID) > start)
                .toList();
    }

    /** Returns the time interval during which the train is on the given blocK. */
    private static TimeInterval getTimeTrainInBlock(
            OccupancySegment unavailableSegment,
            BlockWithOffset block,
            long startOffset,
            EnvelopeTimeInterpolate envelope,
            double startTime
    ) {
        var startBlockOffsetOnEnvelope = block.pathOffset() - startOffset;
        // Offsets on the envelope
        var blockEnterOffset = Distance.toMeters(startBlockOffsetOnEnvelope + unavailableSegment.distanceStart());
        var blockExitOffset = Distance.toMeters(startBlockOffsetOnEnvelope + unavailableSegment.distanceEnd());

        if (blockEnterOffset > envelope.getEndPos() || blockExitOffset < 0)
            return null;

        var enterTime = startTime + envelope.interpolateTotalTimeClamp(blockEnterOffset);
        var exitTime = startTime + envelope.interpolateTotalTimeClamp(blockExitOffset);
        return new TimeInterval(enterTime, exitTime);
    }

    private record TimeInterval(
            double start,
            double end
    ) {}
}
