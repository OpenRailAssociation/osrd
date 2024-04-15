package fr.sncf.osrd.api.pathfinding.constraints

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.graph.EdgeToRanges
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.train.RollingStock

class ConstraintCombiner<EdgeT, OffsetType>(
    val functions: MutableList<EdgeToRanges<EdgeT, OffsetType>> = ArrayList()
) : EdgeToRanges<EdgeT, OffsetType> {
    private val cache = mutableMapOf<EdgeT, Collection<Pathfinding.Range<OffsetType>>>()

    override fun apply(edge: EdgeT): Collection<Pathfinding.Range<OffsetType>> {
        val cached = cache[edge]
        if (cached != null) return cached
        val res = HashSet<Pathfinding.Range<OffsetType>>()
        for (f in functions) res.addAll(f.apply(edge))
        cache[edge] = res
        return res
    }
}

/** Initialize the constraints used to determine whether a block can be explored of not */
fun initConstraints(
    fullInfra: FullInfra,
    rollingStockList: Collection<RollingStock>
): List<PathfindingConstraint<Block>> {
    if (rollingStockList.isEmpty()) return listOf()
    assert(rollingStockList.size == 1)
    val rollingStock = rollingStockList.first()

    val loadingGaugeConstraints =
        LoadingGaugeConstraints(
            fullInfra.blockInfra,
            fullInfra.rawInfra,
            rollingStock.loadingGaugeType
        )
    val signalisationSystemConstraints =
        makeSignalingSystemConstraints(
            fullInfra.blockInfra,
            fullInfra.signalingSimulator,
            rollingStockList
        )

    val res = mutableListOf(loadingGaugeConstraints, signalisationSystemConstraints)
    if (!rollingStock.isThermal)
        res.add(
            ElectrificationConstraints(
                fullInfra.blockInfra,
                fullInfra.rawInfra,
                rollingStock.modeNames
            )
        )
    return res
}
