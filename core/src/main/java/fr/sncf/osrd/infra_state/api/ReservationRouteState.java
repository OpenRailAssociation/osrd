package fr.sncf.osrd.infra_state.api;

import fr.sncf.osrd.infra.api.reservation.ReservationRoute;

public interface ReservationRouteState {
    enum Summary {
        /** The route can be requested */
        FREE,
        /** The route is in the process of becoming available */
        REQUESTED,
        /** The route is ready to be used */
        RESERVED,
        /** The route is occupied */
        OCCUPIED,
        /** The route cannot be activated because of a conflict */
        CONFLICT,
    }

    /** Returns a summary of the state of the route */
    Summary summarize();

    /** Returns the train associated with the route */
    ReservationTrain getTrain();

    /** Returns the immutable route object */
    ReservationRoute getRoute();
}
