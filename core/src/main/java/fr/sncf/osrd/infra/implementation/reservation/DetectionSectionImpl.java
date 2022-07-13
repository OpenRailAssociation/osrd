package fr.sncf.osrd.infra.implementation.reservation;

import com.google.common.base.MoreObjects;
import com.google.common.collect.ImmutableSet;
import fr.sncf.osrd.infra.api.reservation.DetectionSection;
import fr.sncf.osrd.infra.api.reservation.DiDetector;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;

public class DetectionSectionImpl implements DetectionSection {

    private final ImmutableSet<DiDetector> detectors;
    private ImmutableSet<ReservationRoute> routes;

    /** Constructor */
    public DetectionSectionImpl(ImmutableSet<DiDetector> detectors) {
        this.detectors = detectors;
    }

    @Override
    public ImmutableSet<DiDetector> getDetectors() {
        return detectors;
    }

    @Override
    public ImmutableSet<ReservationRoute> getRoutes() {
        return routes;
    }

    void setRoutes(ImmutableSet<ReservationRoute> routes) {
        this.routes = routes;
    }

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("detectors", detectors)
                .toString();
    }
}
