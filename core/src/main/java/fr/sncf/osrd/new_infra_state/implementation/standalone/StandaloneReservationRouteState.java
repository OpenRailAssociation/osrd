package fr.sncf.osrd.new_infra_state.implementation.standalone;

import fr.sncf.osrd.new_infra_state.api.ReservationRouteState;
import fr.sncf.osrd.new_infra_state.api.ReservationTrain;

public class StandaloneReservationRouteState implements ReservationRouteState {
    private final Summary summary;
    private final ReservationTrain train;

    /** Constructor */
    public StandaloneReservationRouteState(Summary summary, ReservationTrain train) {
        this.summary = summary;
        this.train = train;
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
}
