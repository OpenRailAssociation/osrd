package fr.sncf.osrd.api.pathfinding.constraints;

import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.graph.functional_interfaces.EdgeToRanges;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

public record LegacyLoadingGaugeConstraints(
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
     */
    private static Set<Pathfinding.Range> getBlockedRanges(RollingStock stock, ReservationRoute route) {
        double offset = 0;
        var res = new HashSet<Pathfinding.Range>();
        for (var trackRange : route.getTrackRanges()) {
            for (var entry : trackRange.getBlockedGaugeTypes().asMapOfRanges().entrySet()) {
                if (!entry.getValue().isCompatibleWith(stock.loadingGaugeType.ordinal()))
                    res.add(new Pathfinding.Range(
                            offset + entry.getKey().lowerEndpoint(),
                            offset + entry.getKey().upperEndpoint()
                    ));
            }
            offset += trackRange.getLength();
        }
        return res;
    }
}
