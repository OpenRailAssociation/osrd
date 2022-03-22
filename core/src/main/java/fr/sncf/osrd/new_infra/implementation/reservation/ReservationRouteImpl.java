package fr.sncf.osrd.new_infra.implementation.reservation;

import com.google.common.base.MoreObjects;
import com.google.common.collect.ImmutableList;
import fr.sncf.osrd.new_infra.api.reservation.Detector;
import fr.sncf.osrd.new_infra.api.reservation.DiDetector;
import fr.sncf.osrd.new_infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.Collection;

public class ReservationRouteImpl implements ReservationRoute {
    private ImmutableList<ReservationRoute> conflictingRoutes;
    private final ImmutableList<DiDetector> detectorPath;
    private final ImmutableList<Detector> releasePoints;
    public final String id;

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("detectorPath", detectorPath)
                .add("releasePoints", releasePoints)
                .add("id", id)
                .toString();
    }

    /** Constructor */
    public ReservationRouteImpl(
            ImmutableList<DiDetector> detectorPath,
            ImmutableList<Detector> releasePoints,
            String id
    ) {
        this.detectorPath = detectorPath;
        this.releasePoints = releasePoints;
        this.id = id;
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

    /** Sets the conflicting routes (package private). */
    void setConflictingRoutes(Collection<ReservationRoute> routes) {
        conflictingRoutes = ImmutableList.copyOf(routes);
    }
}
