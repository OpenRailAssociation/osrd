package fr.sncf.osrd.api.pathfinding;

import static fr.sncf.osrd.sim_infra.api.PathKt.buildPathFrom;
import static fr.sncf.osrd.utils.KtToJavaConverter.toIntList;

import fr.sncf.osrd.sim_infra.api.*;
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList;

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
}
