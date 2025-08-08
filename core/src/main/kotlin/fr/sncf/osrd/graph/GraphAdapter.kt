package fr.sncf.osrd.graph

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.utils.getBlockExit

/** Implements the Graph interface for the Block infra where node = detector and edge = block */
class GraphAdapter(
    private val blockInfra: BlockInfra,
    private val rawSignalingInfra: RawSignalingInfra,
) : Graph<DirDetectorId, BlockId, Block> {
    override fun getEdgeEnd(edge: BlockId): DirDetectorId {
        return blockInfra.getBlockExit(rawSignalingInfra, edge)
    }

    /** Returns all the edges (blocks) that start at the given node (detector) */
    override fun getAdjacentEdges(node: DirDetectorId): Collection<BlockId> {
        // TODO: make StaticIdxList implement Collection
        val res = mutableListOf<BlockId>()
        for (x in blockInfra.getBlocksStartingAtDetector(node)) res.add(x)
        return res
    }
}
