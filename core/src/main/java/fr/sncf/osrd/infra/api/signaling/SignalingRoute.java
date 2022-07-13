package fr.sncf.osrd.infra.api.signaling;

import fr.sncf.osrd.infra.api.reservation.ReservationRoute;

public interface SignalingRoute {
    ReservationRoute getInfraRoute();

    /** Returns the entry signal for the route */
    Signal<? extends SignalState> getEntrySignal();

    /** Returns a string representing the signaling type of the route (BAL3, TVM, BAPR...) */
    String getSignalingType();
}
