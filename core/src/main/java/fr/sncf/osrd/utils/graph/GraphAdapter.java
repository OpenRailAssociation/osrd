package fr.sncf.osrd.utils.graph;

import fr.sncf.osrd.sim_infra.api.BlockInfra;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.sim_infra.impl.BlockInfraImplKt;
import fr.sncf.osrd.utils.KtToJavaConverter;
import java.util.Collection;

/**
 * Implements the Graph interface for the Block infra
 * where node = detector and edge = block
 */
public class GraphAdapter implements Graph<Integer, Integer> {

    private final BlockInfra blockInfra;
    private final RawSignalingInfra rawSignalingInfra;

    public GraphAdapter(BlockInfra blockInfra, RawSignalingInfra rawSignalingInfra) {
        this.blockInfra = blockInfra;
        this.rawSignalingInfra = rawSignalingInfra;
    }

    @Override
    public Integer getEdgeEnd(Integer blockId) {
        return BlockInfraImplKt.getBlockExit(blockInfra, rawSignalingInfra, blockId);
    }

    /** Returns all the edges (blocks) that start at the given node (detector) */
    @Override
    public Collection<Integer> getAdjacentEdges(Integer detectorId) {
        var neighborBlocks = blockInfra.getBlocksAtDetector(detectorId);
        return KtToJavaConverter.toIntList(neighborBlocks);
    }
}
