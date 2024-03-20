package fr.sncf.osrd.api.pathfinding.constraints

import com.google.common.collect.Range
import com.google.common.collect.RangeSet
import com.google.common.collect.TreeRangeSet
import fr.sncf.osrd.api.pathfinding.makePathProps
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import java.util.stream.Collectors

data class ElectrificationConstraints(
    val blockInfra: BlockInfra,
    val rawInfra: RawSignalingInfra,
    val rollingStocks: Collection<RollingStock>
) : PathfindingConstraint<Block> {
    override fun apply(edge: BlockId): MutableCollection<Pathfinding.Range<Block>> {
        val res = HashSet<Pathfinding.Range<Block>>()
        val path = makePathProps(blockInfra, rawInfra, edge)
        for (stock in rollingStocks) res.addAll(getBlockedRanges(stock, path))
        return res
    }

    companion object {
        /**
         * Returns the sections of the given block that can't be used by the given rolling stock
         * because it needs electrified tracks and isn't compatible with the electrifications in
         * some range
         */
        private fun getBlockedRanges(
            stock: RollingStock,
            path: PathProperties
        ): Set<Pathfinding.Range<Block>> {
            if (stock.isThermal) return setOf()
            val res = HashSet<Pathfinding.Range<Block>>()
            val voltages = path.getElectrification()
            val neutralSections = rangeSetFromMap(path.getNeutralSections())
            for ((lower, upper, value) in voltages) {
                if (lower == upper) continue
                if (!stock.modeNames.contains(value)) {
                    val voltageInterval = Range.open(lower, upper)
                    val blockingRanges =
                        neutralSections.complement().subRangeSet(voltageInterval).asRanges()
                    for (blockingRange in blockingRanges) {
                        assert(blockingRange.lowerEndpoint() < blockingRange.upperEndpoint())
                        res.add(
                            Pathfinding.Range(
                                Offset(blockingRange.lowerEndpoint()),
                                Offset(blockingRange.upperEndpoint())
                            )
                        )
                    }
                }
            }
            return res
        }

        private fun <T> rangeSetFromMap(rangeMap: DistanceRangeMap<T>): RangeSet<Distance> {
            return TreeRangeSet.create(
                rangeMap
                    .asList()
                    .stream()
                    .map { (lower, upper): DistanceRangeMap.RangeMapEntry<T> ->
                        Range.closed(lower, upper)
                    }
                    .collect(Collectors.toSet())
            )
        }
    }
}
