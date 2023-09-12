package fr.sncf.osrd.api.pathfinding;

import static fr.sncf.osrd.sim_infra.api.PathPropertiesKt.buildPathPropertiesFrom;

import fr.sncf.osrd.sim_infra.api.BlockInfra;
import fr.sncf.osrd.sim_infra.api.PathProperties;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;

public class PathfindingUtils {

    public static PathProperties makePath(BlockInfra blockInfra, RawSignalingInfra rawInfra, Integer blockIdx) {
        return makePath(blockInfra, rawInfra, blockIdx, 0, blockInfra.getBlockLength(blockIdx));
    }

    /** Creates the path from a given block id */
    public static PathProperties makePath(BlockInfra blockInfra, RawSignalingInfra rawInfra, Integer blockIdx,
                                          long beginOffset, long endOffset) {
        return buildPathPropertiesFrom(rawInfra, blockInfra.getTrackChunksFromBlock(blockIdx), beginOffset, endOffset);
    }
}
