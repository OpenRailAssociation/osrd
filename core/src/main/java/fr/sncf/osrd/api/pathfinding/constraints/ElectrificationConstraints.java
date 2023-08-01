package fr.sncf.osrd.api.pathfinding.constraints;

import static fr.sncf.osrd.api.pathfinding.PathfindingUtils.makePath;

import com.google.common.collect.Range;
import com.google.common.collect.RangeSet;
import com.google.common.collect.TreeRangeSet;
import fr.sncf.osrd.sim_infra.api.BlockInfra;
import fr.sncf.osrd.sim_infra.api.Path;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.DistanceRangeMap;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.graph.functional_interfaces.EdgeToRanges;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

public record ElectrificationConstraints(
        BlockInfra blockInfra,
        RawSignalingInfra rawInfra,
        Collection<RollingStock> rollingStocks
) implements EdgeToRanges<Integer> {

    @Override
    public Collection<Pathfinding.Range> apply(Integer blockIdx) {
        var res = new HashSet<Pathfinding.Range>();
        var path = makePath(blockInfra, rawInfra, blockIdx);
        for (var stock : rollingStocks)
            res.addAll(getBlockedRanges(stock, path));
        return res;
    }

    /**
     * Returns the sections of the given block that can't be used by the given rolling stock
     * because it needs electrified tracks and isn't compatible with the catenaries in some range
     */
    private Set<Pathfinding.Range> getBlockedRanges(RollingStock stock, Path path) {
        if (!stock.isElectricOnly())
            return Set.of();

        var voltages = path.getCatenary();
        var deadSections = rangeSetFromMap(path.getDeadSections());

        var res = new HashSet<Pathfinding.Range>();
        for (var voltageEntry : voltages) {
            var voltageInterval = Range.open(voltageEntry.getLower(), voltageEntry.getUpper());
            if (voltageEntry.getLower() == voltageEntry.getUpper())
                continue;
            if (!stock.getModeNames().contains(voltageEntry.getValue())) {
                var blockingRanges = deadSections.complement().subRangeSet(voltageInterval).asRanges();
                for (var blockingRange : blockingRanges) {
                    res.add(new Pathfinding.Range(blockingRange.lowerEndpoint(), blockingRange.upperEndpoint()));
                }
            }
        }
        return res;
    }

    private static <T> RangeSet<Long> rangeSetFromMap(DistanceRangeMap<T> rangeMap) {
        return TreeRangeSet.create(
                rangeMap.asList().stream()
                        .map(entry -> Range.open(entry.getLower(), entry.getUpper()))
                        .collect(Collectors.toSet())
        );
    }
}
