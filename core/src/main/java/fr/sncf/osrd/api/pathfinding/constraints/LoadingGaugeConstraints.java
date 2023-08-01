package fr.sncf.osrd.api.pathfinding.constraints;

import static fr.sncf.osrd.api.pathfinding.PathfindingUtils.makePath;

import fr.sncf.osrd.sim_infra.api.BlockInfra;
import fr.sncf.osrd.sim_infra.api.Path;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.graph.functional_interfaces.EdgeToRanges;
import java.util.Collection;
import java.util.HashSet;
import java.util.stream.Collectors;

public record LoadingGaugeConstraints(
        BlockInfra blockInfra,
        RawSignalingInfra infra,
        Collection<RollingStock> rollingStocks
) implements EdgeToRanges<Integer> {

    @Override
    public Collection<Pathfinding.Range> apply(Integer blockIdx) {
        var res = new HashSet<Pathfinding.Range>();
        var path = makePath(blockInfra, infra, blockIdx);
        for (var stock : rollingStocks)
            res.addAll(getBlockedRanges(stock, path));
        return res;
    }

    /**
     * Returns the sections of the given block that can't be used by the given rolling stock
     */
    private Collection<Pathfinding.Range> getBlockedRanges(RollingStock stock, Path path) {
        return path.getLoadingGauge().asList().stream()
                .filter(entry -> !entry.getValue().isCompatibleWith(stock.loadingGaugeType.ordinal()))
                .map(entry -> new Pathfinding.Range(entry.getLower(), entry.getUpper()))
                .collect(Collectors.toSet());
    }
}
