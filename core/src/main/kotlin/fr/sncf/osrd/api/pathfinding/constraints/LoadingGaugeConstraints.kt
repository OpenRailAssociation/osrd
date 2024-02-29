package fr.sncf.osrd.api.pathfinding.constraints

import fr.sncf.osrd.api.pathfinding.makePathProps
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.units.Offset
import java.util.stream.Collectors

data class LoadingGaugeConstraints(
    val blockInfra: BlockInfra,
    val infra: RawSignalingInfra,
    val rollingStocks: Collection<RollingStock>
) : PathfindingConstraint<Block> {
    override fun apply(edge: BlockId): Collection<Pathfinding.Range<Block>> {
        val res = HashSet<Pathfinding.Range<Block>>()
        val path = makePathProps(blockInfra, infra, edge)
        for (stock in rollingStocks) res.addAll(getBlockedRanges(stock, path))
        return res
    }

    /** Returns the sections of the given block that can't be used by the given rolling stock */
    private fun getBlockedRanges(
        stock: RollingStock,
        path: PathProperties
    ): Collection<Pathfinding.Range<Block>> {
        return path
            .getLoadingGauge()
            .asList()
            .stream()
            .filter { (_, _, value): DistanceRangeMap.RangeMapEntry<LoadingGaugeConstraint> ->
                !value.isCompatibleWith(LoadingGaugeTypeId(stock.loadingGaugeType.ordinal.toUInt()))
            }
            .map { (lower, upper): DistanceRangeMap.RangeMapEntry<LoadingGaugeConstraint> ->
                Pathfinding.Range(Offset<Block>(lower), Offset<Block>(upper))
            }
            .collect(Collectors.toSet())
    }
}
