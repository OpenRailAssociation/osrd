package fr.sncf.osrd.new_infra.implementation.reservation;

import com.google.common.base.MoreObjects;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import fr.sncf.osrd.new_infra.api.reservation.DiDetector;
import fr.sncf.osrd.new_infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.new_infra.api.tracks.undirected.Detector;
import fr.sncf.osrd.new_infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.Collection;

public class ReservationRouteImpl implements ReservationRoute {
    private ImmutableSet<ReservationRoute> conflictingRoutes = ImmutableSet.of();
    private final ImmutableList<DiDetector> detectorPath;
    private final ImmutableList<Detector> releasePoints;
    public final String id;
    private final ImmutableList<TrackRangeView> trackRanges;
    private final boolean isControlled;
    private final double length;

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("id", id)
                .add("length", length)
                .toString();
    }

    /** Constructor */
    public ReservationRouteImpl(
            ImmutableList<DiDetector> detectorPath,
            ImmutableList<Detector> releasePoints,
            String id,
            ImmutableList<TrackRangeView> trackRanges,
            boolean isControlled,
            double length) {
        this.detectorPath = detectorPath;
        this.releasePoints = releasePoints;
        this.trackRanges = trackRanges;
        this.id = id;
        this.isControlled = isControlled;
        this.length = length;
    }

    @Override
    public String getID() {
        return id;
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
    public ImmutableSet<ReservationRoute> getConflictingRoutes() {
        return conflictingRoutes;
    }

    /** Sets the conflicting routes (package private). */
    void setConflictingRoutes(Collection<ReservationRoute> routes) {
        conflictingRoutes = ImmutableSet.copyOf(routes);
    }

    @Override
    public ImmutableList<TrackRangeView> getTrackRanges() {
        return trackRanges;
    }

    @Override
    public double getLength() {
        return length;
    }

    @Override
    public boolean isControlled() {
        return isControlled;
    }
}
