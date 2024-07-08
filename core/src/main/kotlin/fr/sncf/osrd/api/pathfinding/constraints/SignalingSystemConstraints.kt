package fr.sncf.osrd.api.pathfinding.constraints

import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.signaling.SignalingSimulator
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.SignalingSystemId
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

data class SignalingSystemConstraints(
    val blockInfra: BlockInfra,
    val rollingStocksSupportedSigSystems: List<List<SignalingSystemId>>
) : PathfindingConstraint<Block> {
    override fun apply(edge: BlockId): MutableCollection<Pathfinding.Range<Block>> {
        val res = HashSet<Pathfinding.Range<Block>>()
        for (rollingStockSigSystems in rollingStocksSupportedSigSystems) {
            val edgeBlockedRanges = getBlockedRanges(edge, blockInfra, rollingStockSigSystems)
            if (edgeBlockedRanges.isNotEmpty()) {
                res.addAll(edgeBlockedRanges)
                // if this edge is blocked for 2 RS, we will have the same exact range (the full
                // edge range) twice
                break
            }
        }
        return res
    }

    /** Returns the sections of the given block that can't be used by the given rolling stock */
    private fun getBlockedRanges(
        edge: BlockId,
        blockInfra: BlockInfra,
        rollingStockSigSystems: List<SignalingSystemId>
    ): Set<Pathfinding.Range<Block>> {
        val blockSigSystem = blockInfra.getBlockSignalingSystem(edge)
        val isRSCompatibleWithBlock = rollingStockSigSystems.contains(blockSigSystem)
        if (isRSCompatibleWithBlock) {
            return setOf()
        }
        return setOf(Pathfinding.Range(Offset(0.meters), blockInfra.getBlockLength(edge)))
    }
}

fun makeSignalingSystemConstraints(
    blockInfra: BlockInfra,
    signalingSimulator: SignalingSimulator,
    rollingStocks: Collection<RollingStock>,
): SignalingSystemConstraints {
    val rsSupportedSigSystems =
        rollingStocks.map { stock ->
            stock.supportedSignalingSystems.mapNotNull {
                signalingSimulator.sigModuleManager.findSignalingSystem(it)
            }
        }
    return SignalingSystemConstraints(blockInfra, rsSupportedSigSystems)
}
