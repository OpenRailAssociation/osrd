package fr.sncf.osrd.api.pathfinding.constraints;

import static fr.sncf.osrd.sim_infra.api.PathKt.buildPathFrom;
import static fr.sncf.osrd.utils.KtToJavaConverter.toIntList;

import fr.sncf.osrd.sim_infra.api.BlockInfra;
import fr.sncf.osrd.sim_infra.api.Path;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.sim_infra.api.TrackChunk;
import fr.sncf.osrd.sim_infra.impl.PathImpl;
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList;
import fr.sncf.osrd.utils.units.Distance;

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
