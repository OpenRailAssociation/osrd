package fr.sncf.osrd.pathfinding.constraints

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.graph.EdgeToRanges
import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.pathfinding.Pathfinding
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
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

/** Initialize the constraints used to determine whether a block can be explored */
fun initConstraints(
    fullInfra: FullInfra,
    rollingStock: RollingStock,
): List<PathfindingConstraint<Block>> {
    return initConstraintsFromRSProps(
        fullInfra,
        rollingStock.isThermal,
        rollingStock.loadingGaugeType,
        rollingStock.modeNames.toList(),
        rollingStock.supportedSignalingSystems.toList(),
    )
}

fun initConstraintsFromRSProps(
    infra: FullInfra,
    rollingStockIsThermal: Boolean,
    rollingStockLoadingGauge: RJSLoadingGaugeType,
    rollingStockSupportedElectrification: List<String>,
    rollingStockSupportedSignalingSystems: List<String>,
): List<PathfindingConstraint<Block>> {
    val res = mutableListOf<PathfindingConstraint<Block>>()
    if (!rollingStockIsThermal) {
        res.add(
            ElectrificationConstraints(
                infra.blockInfra,
                infra.rawInfra,
                rollingStockSupportedElectrification,
            )
        )
    }
    res.add(LoadingGaugeConstraints(infra.blockInfra, infra.rawInfra, rollingStockLoadingGauge))
    val sigSystemIds =
        rollingStockSupportedSignalingSystems.mapNotNull {
            infra.signalingSimulator.sigModuleManager.findSignalingSystem(it)
        }
    res.add(SignalingSystemConstraints(infra.blockInfra, listOf(sigSystemIds)))
    return res
}
