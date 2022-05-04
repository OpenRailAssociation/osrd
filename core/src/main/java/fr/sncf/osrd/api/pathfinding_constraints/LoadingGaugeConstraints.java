package fr.sncf.osrd.api.pathfinding_constraints;

import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import java.util.function.Function;

public record LoadingGaugeConstraints(
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
     */
    private static Set<Pathfinding.Range> getBlockedRanges(RollingStock stock, ReservationRoute route) {
        var offset = 0;
        var res = new HashSet<Pathfinding.Range>();
        for (var trackRange : route.getTrackRanges()) {
            for (var entry : trackRange.getBlockedGaugeTypes().asMapOfRanges().entrySet()) {
                if (!entry.getValue().isCompatibleWith(stock.loadingGaugeType))
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
