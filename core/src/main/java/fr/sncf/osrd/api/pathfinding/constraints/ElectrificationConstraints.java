package fr.sncf.osrd.api.pathfinding.constraints;

import com.google.common.collect.RangeMap;
import com.google.common.collect.RangeSet;
import com.google.common.collect.TreeRangeSet;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.graph.functional_interfaces.EdgeToRanges;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

public record ElectrificationConstraints(
        Collection<RollingStock> rollingStocks
) implements EdgeToRanges<SignalingRoute> {

    @Override
    public Collection<Pathfinding.Range> apply(SignalingRoute reservationRoute) {
        var res = new HashSet<Pathfinding.Range>();
        for (var stock : rollingStocks)
            res.addAll(getBlockedRanges(stock, reservationRoute.getInfraRoute()));
        return res;
    }

    /**
     * Returns the sections of the given route that can't be used by the given rolling stock
     * because it needs electrified tracks and isn't compatible with the catenaries in some range
     */
    private static Set<Pathfinding.Range> getBlockedRanges(RollingStock stock, ReservationRoute route) {
        if (!stock.isElectricOnly())
            return Set.of();

        var res = new HashSet<Pathfinding.Range>();
        double offset = 0;
        for (var range : route.getTrackRanges()) {
            var voltages = range.getCatenaryVoltages();
            var neutralSections = rangeSetFromMap(range.getNeutralSections());
            for (var section : voltages.asMapOfRanges().entrySet()) {
                var interval = section.getKey();
                if (Math.abs(interval.lowerEndpoint() - interval.upperEndpoint()) < 1e-5)
                    continue;
                if (!stock.getModeNames().contains(section.getValue())) {
                    var blockingRanges = neutralSections.complement().subRangeSet(interval).asRanges();

                    for (var blockingRange : blockingRanges) {
                        res.add(new Pathfinding.Range(
                                offset + blockingRange.lowerEndpoint(),
                                offset + blockingRange.upperEndpoint())
                        );
                    }
                }
            }
            offset += range.getLength();
        }
        return res;
    }

    private static <T> RangeSet<Double> rangeSetFromMap(RangeMap<Double, T> rangeMap) {
        return TreeRangeSet.create(rangeMap.asMapOfRanges().keySet());
    }
}
