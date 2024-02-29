package fr.sncf.osrd.api.pathfinding.constraints

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.graph.EdgeToRanges
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.train.RollingStock

class ConstraintCombiner<EdgeT, OffsetType> : EdgeToRanges<EdgeT, OffsetType> {
    @JvmField val functions: MutableList<EdgeToRanges<EdgeT, OffsetType>> = ArrayList()

    override fun apply(edge: EdgeT): Collection<Pathfinding.Range<OffsetType>> {
        val res = HashSet<Pathfinding.Range<OffsetType>>()
        for (f in functions) res.addAll(f.apply(edge))
        return res
    }
}

/** Initialize the constraints used to determine whether a block can be explored of not */
fun initConstraints(
    fullInfra: FullInfra,
    rollingStockList: Collection<RollingStock>
): List<PathfindingConstraint<Block>> {

    val loadingGaugeConstraints =
        LoadingGaugeConstraints(fullInfra.blockInfra, fullInfra.rawInfra, rollingStockList)
    val electrificationConstraints =
        ElectrificationConstraints(fullInfra.blockInfra, fullInfra.rawInfra, rollingStockList)
    val signalisationSystemConstraints =
        makeSignalingSystemConstraints(
            fullInfra.blockInfra,
            fullInfra.signalingSimulator,
            rollingStockList
        )

    return listOf(
        loadingGaugeConstraints,
        electrificationConstraints,
        signalisationSystemConstraints
    )
}
