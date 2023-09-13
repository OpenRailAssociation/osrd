package fr.sncf.osrd.api.pathfinding;

import static fr.sncf.osrd.sim_infra.api.PathKt.buildPathFrom;
import static fr.sncf.osrd.utils.KtToJavaConverter.toIntList;

import fr.sncf.osrd.sim_infra.api.BlockInfra;
import fr.sncf.osrd.sim_infra.api.Path;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.sim_infra.api.*;
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList;
import java.util.List;

public class PathfindingUtils {

    public static Path makePath(BlockInfra blockInfra, RawSignalingInfra rawInfra, Integer blockIdx) {
        return makePath(blockInfra, rawInfra, blockIdx, 0, blockInfra.getBlockLength(blockIdx));
    }

    /** Creates the path from a given block id */
    public static Path makePath(BlockInfra blockInfra, RawSignalingInfra rawInfra, Integer blockIdx,
                                long beginOffset, long endOffset) {
        return buildPathFrom(rawInfra, blockInfra.getTrackChunksFromBlock(blockIdx), beginOffset, endOffset);
    }


    /**
     * @param infra FullInfra
     * @param blockIds the blocks in the order they are encountered
     * @param offsetFirstBlock the path offset on the first block in millimeters
     * @return corresponding path
     */
    public static Path makePathFromBlocks(RawSignalingInfra rawInfra,
                                          BlockInfra blockInfra,
                                          List<Integer> blockIds,
                                          long offsetFirstBlock) {
        var chunks = new MutableDirStaticIdxArrayList<TrackChunk>();
        long totalLength = 0;
        for (var blockId : blockIds) {
            for (var zoneId : toIntList(blockInfra.getBlockPath(blockId))) {
                chunks.addAll(rawInfra.getZonePathChunks(zoneId));
                totalLength += rawInfra.getZonePathLength(zoneId);
            }
        }
        return buildPathFrom(rawInfra, chunks, offsetFirstBlock, totalLength);
    }
}
