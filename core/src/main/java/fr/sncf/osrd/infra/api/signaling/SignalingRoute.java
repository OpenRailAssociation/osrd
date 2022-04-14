package fr.sncf.osrd.infra.api.signaling;

import fr.sncf.osrd.infra.api.reservation.ReservationRoute;

public interface SignalingRoute {
    ReservationRoute getInfraRoute();
}
