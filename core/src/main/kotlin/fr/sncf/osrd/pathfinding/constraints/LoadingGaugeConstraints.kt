package fr.sncf.osrd.pathfinding.constraints

import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlock
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.pathfinding.DeprecatedPathfinding
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.units.Offset

data class LoadingGaugeConstraints(
    val blockInfra: BlockInfra,
    val infra: RawSignalingInfra,
    val loadingGaugeType: RJSLoadingGaugeType,
) : PathfindingConstraint<Block> {
    override fun apply(edge: BlockId): Collection<DeprecatedPathfinding.Range<Block>> {
        val res = HashSet<DeprecatedPathfinding.Range<Block>>()
        val path = buildTrainPathFromBlock(infra, blockInfra, edge)
        res.addAll(getBlockedRanges(loadingGaugeType, path))
        return res
    }

    /** Returns the sections of the given block that can't be used by the given rolling stock */
    private fun getBlockedRanges(
        type: RJSLoadingGaugeType,
        path: TrainPath,
    ): Collection<DeprecatedPathfinding.Range<Block>> {
        return path
            .getLoadingGauge()
            .toSet()
            .filter { !it.value.isCompatibleWith(LoadingGaugeTypeId(type.ordinal.toUInt())) }
            .map { (lower, upper) -> DeprecatedPathfinding.Range(Offset(lower), Offset(upper)) }
    }
}
