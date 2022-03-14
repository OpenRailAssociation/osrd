package fr.sncf.osrd.new_infra.implementation.reservation;

import com.google.common.collect.ImmutableList;
import fr.sncf.osrd.new_infra.api.reservation.Detector;
import fr.sncf.osrd.new_infra.api.reservation.DiDetector;
import fr.sncf.osrd.new_infra.api.reservation.ReservationRoute;

import java.util.Collection;

public class ReservationRouteImpl implements ReservationRoute {
    private ImmutableList<ReservationRoute> conflictingRoutes;
    private final ImmutableList<DiDetector> detectorPath;
    private final ImmutableList<Detector> releasePoints;
    private final ImmutableList.Builder<ReservationRoute> conflictingRoutesBuilder;
    public final String id;

    /** Constructor */
    public ReservationRouteImpl(
            ImmutableList<DiDetector> detectorPath,
            ImmutableList<Detector> releasePoints,
            String id
    ) {
        this.detectorPath = detectorPath;
        this.releasePoints = releasePoints;
        conflictingRoutesBuilder = new ImmutableList.Builder<>();
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

    /** Registers a collection of conflicting routes (module private) */
    void registerConflict(Collection<ReservationRouteImpl> routes) {
        for (var route : routes)
            if (route != this)
                conflictingRoutesBuilder.add(route);
    }

    /** Builds the conflicting route list (module private) */
    void build() {
        conflictingRoutes = conflictingRoutesBuilder.build();
    }
}
