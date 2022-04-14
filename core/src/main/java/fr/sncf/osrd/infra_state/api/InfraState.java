package fr.sncf.osrd.infra_state.api;

import fr.sncf.osrd.infra.api.reservation.DetectionSection;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;

public interface InfraState extends InfraStateView {
    /** Sets the state of a given detection section */
    void setState(DetectionSection section, DetectionSectionState state);

    /** Sets the state of a given reservation route */
    void setState(ReservationRoute route, ReservationRouteState state);
}
