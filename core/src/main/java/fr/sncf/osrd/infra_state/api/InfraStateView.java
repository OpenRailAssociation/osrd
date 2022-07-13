package fr.sncf.osrd.infra_state.api;

import fr.sncf.osrd.infra.api.reservation.DetectionSection;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;

public interface InfraStateView {
    /** Returns the state of a reservation section */
    DetectionSectionState getState(DetectionSection section);

    /** Returns the state of a reservation route */
    ReservationRouteState getState(ReservationRoute route);
}
