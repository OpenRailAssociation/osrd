package fr.sncf.osrd.api.pathfinding;

import static fr.sncf.osrd.sim_infra.api.PathKt.buildPathFrom;

import fr.sncf.osrd.sim_infra.api.BlockInfra;
import fr.sncf.osrd.sim_infra.api.Path;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;

public class PathfindingUtils {

    public static Path makePath(BlockInfra blockInfra, RawSignalingInfra rawInfra, Integer blockIdx) {
        return makePath(blockInfra, rawInfra, blockIdx, 0, blockInfra.getBlockLength(blockIdx));
    }

    /** Creates the path from a given block id */
    public static Path makePath(BlockInfra blockInfra, RawSignalingInfra rawInfra, Integer blockIdx,
                                long beginOffset, long endOffset) {
        return buildPathFrom(rawInfra, blockInfra.getTrackChunksFromBlock(blockIdx), beginOffset, endOffset);
    }
}
