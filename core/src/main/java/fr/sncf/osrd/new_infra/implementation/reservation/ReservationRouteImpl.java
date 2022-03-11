package fr.sncf.osrd.new_infra.implementation.reservation;

import com.google.common.collect.ImmutableList;
import fr.sncf.osrd.new_infra.api.reservation.Detector;
import fr.sncf.osrd.new_infra.api.reservation.DiDetector;
import fr.sncf.osrd.new_infra.api.reservation.ReservationRoute;

public class ReservationRouteImpl implements ReservationRoute {
    private final ImmutableList<ReservationRoute> conflictingRoutes;
    private final ImmutableList<DiDetector> detectorPath;
    private final ImmutableList<Detector> releasePoints;

    /** Constructor */
    public ReservationRouteImpl(
            ImmutableList<ReservationRoute> conflictingRoutes,
            ImmutableList<DiDetector> detectorPath,
            ImmutableList<Detector> releasePoints
    ) {
        this.conflictingRoutes = conflictingRoutes;
        this.detectorPath = detectorPath;
        this.releasePoints = releasePoints;
    }

    @Override
    public ImmutableList<DiDetector> getDetectorPath() {
        return detectorPath;
    }

    @Override
    public ImmutableList<Detector> getReleasePoints() {
        return releasePoints;
    }

    @Override
    public ImmutableList<ReservationRoute> getConflictingRoutes() {
        return conflictingRoutes;
    }
}
