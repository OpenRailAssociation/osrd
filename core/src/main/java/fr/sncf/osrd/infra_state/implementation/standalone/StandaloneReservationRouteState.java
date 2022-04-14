package fr.sncf.osrd.infra_state.implementation.standalone;

import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.infra_state.api.ReservationRouteState;
import fr.sncf.osrd.infra_state.api.ReservationTrain;

public class StandaloneReservationRouteState implements ReservationRouteState {
    private final Summary summary;
    private final ReservationTrain train;
    private final ReservationRoute route;

    /** Constructor */
    public StandaloneReservationRouteState(Summary summary, ReservationTrain train, ReservationRoute route) {
        this.summary = summary;
        this.train = train;
        this.route = route;
        assert summary.equals(Summary.FREE) == (train == null)
                : "reservation train must be null if and only if section is free";
    }

    @Override
    public Summary summarize() {
        return summary;
    }

    @Override
    public ReservationTrain getTrain() {
        return train;
    }

    @Override
    public ReservationRoute getRoute() {
        return route;
    }
}
