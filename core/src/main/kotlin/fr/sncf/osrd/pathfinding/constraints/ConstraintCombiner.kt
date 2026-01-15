package fr.sncf.osrd.pathfinding.constraints

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.TrackSectionId
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.units.OffsetRange

class ConstraintCombiner(val functions: List<PathfindingConstraint> = ArrayList()) :
    PathfindingConstraint {
    private val cache = mutableMapOf<BlockId, Collection<OffsetRange<Block>>>()

    override fun apply(edge: BlockId): Collection<OffsetRange<Block>> {
        val cached = cache[edge]
        if (cached != null) return cached
        val res = HashSet<OffsetRange<Block>>()
        for (f in functions) res.addAll(f.apply(edge))
        cache[edge] = res
        return res
    }
}

/** Initialize the constraints used to determine whether a block can be explored */
fun initConstraints(
    fullInfra: FullInfra,
    rollingStock: RollingStock,
    allowedTrackSections: Set<TrackSectionId>? = null,
): List<PathfindingConstraint> {
    return initConstraintsFromRSProps(
        fullInfra,
        rollingStock.isThermal,
        rollingStock.loadingGaugeType,
        rollingStock.modeNames.toList(),
        rollingStock.supportedSignalingSystems.toList(),
        allowedTrackSections,
    )
}

fun initConstraintsFromRSProps(
    infra: FullInfra,
    rollingStockIsThermal: Boolean,
    rollingStockLoadingGauge: RJSLoadingGaugeType,
    rollingStockSupportedElectrification: List<String>,
    rollingStockSupportedSignalingSystems: List<String>,
    allowedTrackSections: Set<TrackSectionId>? = null,
): List<PathfindingConstraint> {
    val res = mutableListOf<PathfindingConstraint>()
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
    if (allowedTrackSections != null)
        res.add(TrackSectionConstraints(infra.blockInfra, infra.rawInfra, allowedTrackSections))
    return res
}
