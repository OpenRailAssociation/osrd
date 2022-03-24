package fr.sncf.osrd.new_infra_state.api;

import fr.sncf.osrd.new_infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.new_infra.api.signaling.Signal;
import java.util.Set;

public interface SignalizationState extends SignalizationStateView {

    /** Notify that the route state has changed. Returns a set of updated signals */
    Set<Signal<?>> notifyUpdate(ReservationRoute route);
}
