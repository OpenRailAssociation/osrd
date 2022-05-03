package fr.sncf.osrd.infra.api.signaling;

import fr.sncf.osrd.infra.api.reservation.ReservationRoute;

public interface SignalingRoute {
    ReservationRoute getInfraRoute();

    /** Returns the entry signal for the route */
    Signal<?> getEntrySignal();
}
