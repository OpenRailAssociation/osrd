package fr.sncf.osrd.api.pathfinding.constraints;

import com.google.common.collect.Sets;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.reporting.exceptions.NotImplemented;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import java.util.function.Function;

public record ElectrificationConstraints(
        Collection<RollingStock> rollingStocks
) implements Function<SignalingRoute, Collection<Pathfinding.Range>> {

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
        if (!stock.isElectricOnly)
            return Set.of();
        var res = new HashSet<Pathfinding.Range>();
        double offset = 0;
        for (var range : route.getTrackRanges()) {
            var voltages = range.getCatenaryVoltages();
            for (var section : voltages.asMapOfRanges().entrySet()) {
                var interval = section.getKey();
                if (Math.abs(interval.lowerEndpoint() - interval.upperEndpoint()) < 1e-5)
                    continue;
                var overlap = Sets.intersection(section.getValue(), stock.compatibleVoltages);
                if (overlap.isEmpty()) {
                    res.add(new Pathfinding.Range(
                            offset + interval.lowerEndpoint(),
                            offset + interval.upperEndpoint())
                    );
                }
            }
            offset += range.getLength();
        }
        return res;
    }
}
