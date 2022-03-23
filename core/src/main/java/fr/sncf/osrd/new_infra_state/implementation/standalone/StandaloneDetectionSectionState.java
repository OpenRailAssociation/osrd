package fr.sncf.osrd.new_infra_state.implementation.standalone;

import fr.sncf.osrd.new_infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.new_infra_state.api.DetectionSectionState;
import fr.sncf.osrd.new_infra_state.api.ReservationTrain;

public class StandaloneDetectionSectionState implements DetectionSectionState {

    private final Summary summary;
    private final ReservationRoute route;
    private final ReservationTrain occupyingTrain;

    /** Constructor */
    public StandaloneDetectionSectionState(Summary summary, ReservationRoute route, ReservationTrain occupyingTrain) {
        this.summary = summary;
        this.route = route;
        this.occupyingTrain = occupyingTrain;
        assert summary.equals(Summary.FREE) == (occupyingTrain == null)
                : "occupying train must be null if and only if section is free";
        assert summary.equals(Summary.FREE) == (route == null)
                : "route must be null if and only if section is free";
    }

    @Override
    public Summary summarize() {
        return summary;
    }

    @Override
    public ReservationRoute getRoute() {
        return route;
    }

    @Override
    public ReservationTrain getOccupyingTrain() {
        return occupyingTrain;
    }
}
