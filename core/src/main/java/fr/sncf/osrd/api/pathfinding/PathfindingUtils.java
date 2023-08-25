package fr.sncf.osrd.api.pathfinding;

import static fr.sncf.osrd.sim_infra.api.PathKt.buildPathFrom;
import static fr.sncf.osrd.utils.KtToJavaConverter.toIntList;

import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.sim_infra.api.*;
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList;
import java.util.List;

public class PathfindingUtils {

    /** Creates the path from a given block id */
    public static Path makePath(BlockInfra blockInfra, RawSignalingInfra infra, Integer blockIdx) {
        var chunks = new MutableDirStaticIdxArrayList<TrackChunk>();
        long totalLength = 0;
        for (var zoneIdx : toIntList(blockInfra.getBlockPath(blockIdx))) {
            chunks.addAll(infra.getZonePathChunks(zoneIdx));
            totalLength += infra.getZonePathLength(zoneIdx);
        }
        return buildPathFrom(infra, chunks, 0, totalLength);
    }


    /**
     * @param infra FullInfra
     * @param blockIds the blocks in the order they are encountered
     * @param offsetFirstBlock the path offset on the first block in millimeters
     * @return corresponding path
     */
    public static Path makePathFromBlocks(FullInfra infra,
                                          List<Integer> blockIds,
                                          long offsetFirstBlock) {
        var chunks = new MutableDirStaticIdxArrayList<TrackChunk>();
        long totalLength = 0;
        for (var blockId : blockIds) {
            for (var zoneId : toIntList(infra.blockInfra().getBlockPath(blockId))) {
                chunks.addAll(infra.rawInfra().getZonePathChunks(zoneId));
                totalLength += infra.rawInfra().getZonePathLength(zoneId);
            }
        }
        return buildPathFrom(infra.rawInfra(), chunks, offsetFirstBlock, totalLength);
    }
}
