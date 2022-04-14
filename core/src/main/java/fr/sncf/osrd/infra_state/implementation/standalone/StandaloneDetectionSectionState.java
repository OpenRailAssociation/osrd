package fr.sncf.osrd.infra_state.implementation.standalone;

import fr.sncf.osrd.infra.api.reservation.DetectionSection;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.infra_state.api.DetectionSectionState;
import fr.sncf.osrd.infra_state.api.ReservationTrain;

public class StandaloneDetectionSectionState implements DetectionSectionState {

    private final Summary summary;
    private final ReservationRoute route;
    private final ReservationTrain occupyingTrain;
    private final DetectionSection detectionSection;

    /** Constructor */
    public StandaloneDetectionSectionState(
            Summary summary,
            ReservationRoute route,
            ReservationTrain occupyingTrain,
            DetectionSection detectionSection
    ) {
        this.summary = summary;
        this.route = route;
        this.occupyingTrain = occupyingTrain;
        this.detectionSection = detectionSection;
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

    @Override
    public DetectionSection getDetectionSection() {
        return detectionSection;
    }
}
