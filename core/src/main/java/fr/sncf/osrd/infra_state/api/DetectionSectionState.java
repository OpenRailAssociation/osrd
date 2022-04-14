package fr.sncf.osrd.infra_state.api;

import fr.sncf.osrd.infra.api.reservation.DetectionSection;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;

/** Encodes the state of the detection section */
public interface DetectionSectionState {
    enum Summary {
        FREE,
        RESERVED,
        OCCUPIED,
    }

    Summary summarize();

    /** Returns the route for which this detection state is currently reserved for */
    ReservationRoute getRoute();

    /** Returns the train which currently occupies the detection section */
    ReservationTrain getOccupyingTrain();

    /** Returns the immutable detection section object */
    DetectionSection getDetectionSection();
}
