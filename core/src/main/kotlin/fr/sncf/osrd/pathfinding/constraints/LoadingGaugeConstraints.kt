package fr.sncf.osrd.pathfinding.constraints

import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlock
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.OffsetRange

data class LoadingGaugeConstraints(
    val blockInfra: BlockInfra,
    val infra: RawSignalingInfra,
    val loadingGaugeType: RJSLoadingGaugeType,
) : PathfindingConstraint {
    override fun apply(edge: BlockId): Collection<OffsetRange<Block>> {
        val res = HashSet<OffsetRange<Block>>()
        val path = buildTrainPathFromBlock(infra, blockInfra, edge)
        res.addAll(getBlockedRanges(loadingGaugeType, path))
        return res
    }

    /** Returns the sections of the given block that can't be used by the given rolling stock */
    private fun getBlockedRanges(
        type: RJSLoadingGaugeType,
        path: TrainPath,
    ): Collection<OffsetRange<Block>> {
        return path
            .getLoadingGauge()
            .toSet()
            .filter { !it.value.isCompatibleWith(LoadingGaugeTypeId(type.ordinal.toUInt())) }
            .map { (lower, upper) -> OffsetRange(Offset(lower), Offset(upper)) }
    }
}
