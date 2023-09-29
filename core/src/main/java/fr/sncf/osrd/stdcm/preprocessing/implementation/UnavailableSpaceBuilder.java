package fr.sncf.osrd.stdcm.preprocessing.implementation;

import static fr.sncf.osrd.utils.KtToJavaConverter.toIntList;

import com.google.common.collect.HashMultimap;
import com.google.common.collect.Multimap;
import com.google.common.collect.Range;
import com.google.common.collect.RangeSet;
import com.google.common.collect.TreeRangeSet;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.sim_infra.api.BlockInfra;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.sim_infra.impl.BlockInfraImplKt;
import fr.sncf.osrd.standalone_sim.result.ResultTrain;
import fr.sncf.osrd.stdcm.OccupancySegment;
import fr.sncf.osrd.utils.units.Distance;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public class UnavailableSpaceBuilder {
    private static final long SIGHT_DISTANCE = Distance.fromMeters(400);

    /** Computes the unavailable space for each block, i.e.
     * the times and positions where the *head* of the train cannot be.
     * This considers existing occupancy segments, the length of the train,
     * and the blocks that must be left available behind the train
     * <br/>
     * This is the first step to compute STDCM, the goal is to get rid of railway rules and extra complexity
     * as soon as possible. After this step we can look for a single curve that avoids unavailable segment. */
    public static Multimap<Integer, OccupancySegment> computeUnavailableSpace(
            RawSignalingInfra infra,
            BlockInfra blockInfra,
            Collection<ResultTrain.SpacingRequirement> spacingRequirements,
            PhysicsRollingStock rollingStock,
            double marginToAddBeforeEachBlock,
            double marginToAddAfterEachBlock
    ) {
        Multimap<Integer, OccupancySegment> unavailableSpace = HashMultimap.create();

        var blockUse = buildBlockUse(infra, blockInfra, spacingRequirements,
                marginToAddBeforeEachBlock, marginToAddAfterEachBlock);

        for (var blockEntry : blockUse.entrySet()) {
            var blockId = blockEntry.getKey();
            var blockLength = blockInfra.getBlockLength(blockId);
            var useTimes = blockEntry.getValue();
            for (var timeRange : useTimes.asRanges()) {

                // Generate current block occupancy
                unavailableSpace.put(blockId, new OccupancySegment(
                        timeRange.lowerEndpoint(), timeRange.upperEndpoint(), 0, blockLength)
                );

                // Generate the warnings in blocks before the ones used by other trains
                var predecessorBlocks = getPreviousBlocks(infra, blockInfra, blockId);
                for (var predecessorBlock : predecessorBlocks) {
                    var preBlockLength = blockInfra.getBlockLength(predecessorBlock);
                    unavailableSpace.put(predecessorBlock, new OccupancySegment(
                            timeRange.lowerEndpoint(), timeRange.upperEndpoint(), 0, preBlockLength
                    ));

                    // Generate the sight distance requirements in the blocks before that
                    for (var secondPredecessorBlock : getPreviousBlocks(infra, blockInfra, predecessorBlock)) {
                        var secPreBlockLength = blockInfra.getBlockLength(secondPredecessorBlock);
                        unavailableSpace.put(secondPredecessorBlock, new OccupancySegment(
                                timeRange.lowerEndpoint(), timeRange.upperEndpoint(),
                                Math.max(0, secPreBlockLength - SIGHT_DISTANCE), preBlockLength
                        ));
                    }
                }

                // Generate train length occupancy
                var successorBlocks = getNextBlocks(infra, blockInfra, blockId);
                for (var successorBlock : successorBlocks) {
                    var nextBlockLength = blockInfra.getBlockLength(successorBlock);
                    unavailableSpace.put(successorBlock, new OccupancySegment(
                            timeRange.lowerEndpoint(), timeRange.upperEndpoint(),
                            0, Math.min(nextBlockLength, Distance.fromMeters(rollingStock.getLength()))
                    ));
                }
            }
        }
        return unavailableSpace;
    }

    /** Builds the time during which the blocks are used by another train (including a forward signal cascade)
     * This step is also used to merge together the small overlapping time intervals
     * across different zones or trains. */
    private static Map<Integer, RangeSet<Double>> buildBlockUse(
            RawSignalingInfra infra,
            BlockInfra blockInfra,
            Collection<ResultTrain.SpacingRequirement> requirements,
            double marginToAddBeforeEachBlock,
            double marginToAddAfterEachBlock
    ) {
        var res = new HashMap<Integer, RangeSet<Double>>();
        for (var requirement : requirements) {
            var zoneId = infra.getZoneFromName(requirement.zone);
            var timeRange = Range.closed(
                    requirement.beginTime - marginToAddBeforeEachBlock,
                    requirement.endTime + marginToAddAfterEachBlock
            );
            for (var blockId : toIntList(blockInfra.getBlocksInZone(zoneId))) {
                res.putIfAbsent(blockId, TreeRangeSet.create());
                res.get(blockId).add(timeRange);
            }
        }
        return res;
    }

    /** Returns the blocks that lead into the given one */
    private static Set<Integer> getPreviousBlocks(RawSignalingInfra infra, BlockInfra blockInfra, int blockId) {
        var entry = BlockInfraImplKt.getBlockEntry(blockInfra, infra, blockId);
        return new HashSet<>(toIntList(blockInfra.getBlocksEndingAtDetector(entry)));
    }

    /** Returns the blocks that follow the given one */
    private static Set<Integer> getNextBlocks(RawSignalingInfra infra, BlockInfra blockInfra, int blockId) {
        var entry = BlockInfraImplKt.getBlockExit(blockInfra, infra, blockId);
        return new HashSet<>(toIntList(blockInfra.getBlocksStartingAtDetector(entry)));
    }
}
