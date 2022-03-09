package fr.sncf.osrd.new_infra.api.signaling;

import fr.sncf.osrd.new_infra.api.reservation.ReservationRoute;

public interface SignalingRoute {
    ReservationRoute getInfraRoute();
}
