package fr.sncf.osrd.api.pathfinding.constraints

import fr.sncf.osrd.api.pathfinding.makePathProps
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.units.Offset
import java.util.stream.Collectors

data class LoadingGaugeConstraints(
    val blockInfra: BlockInfra,
    val infra: RawSignalingInfra,
    val loadingGaugeType: RJSLoadingGaugeType
) : PathfindingConstraint<Block> {
    override fun apply(edge: BlockId): Collection<Pathfinding.Range<Block>> {
        val res = HashSet<Pathfinding.Range<Block>>()
        val path = makePathProps(blockInfra, infra, edge)
        res.addAll(getBlockedRanges(loadingGaugeType, path))
        return res
    }

    /** Returns the sections of the given block that can't be used by the given rolling stock */
    private fun getBlockedRanges(
        type: RJSLoadingGaugeType,
        path: PathProperties
    ): Collection<Pathfinding.Range<Block>> {
        return path
            .getLoadingGauge()
            .asList()
            .stream()
            .filter { (_, _, value): DistanceRangeMap.RangeMapEntry<LoadingGaugeConstraint> ->
                !value.isCompatibleWith(LoadingGaugeTypeId(type.ordinal.toUInt()))
            }
            .map { (lower, upper): DistanceRangeMap.RangeMapEntry<LoadingGaugeConstraint> ->
                Pathfinding.Range(Offset<Block>(lower), Offset(upper))
            }
            .collect(Collectors.toSet())
    }
}
