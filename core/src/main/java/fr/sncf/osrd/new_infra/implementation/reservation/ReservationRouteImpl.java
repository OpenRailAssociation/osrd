package fr.sncf.osrd.new_infra.implementation.reservation;

import com.google.common.base.MoreObjects;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import fr.sncf.osrd.new_infra.api.reservation.Detector;
import fr.sncf.osrd.new_infra.api.reservation.DiDetector;
import fr.sncf.osrd.new_infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.new_infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.Collection;

public class ReservationRouteImpl implements ReservationRoute {
    private ImmutableSet<ReservationRoute> conflictingRoutes;
    private final ImmutableList<DiDetector> detectorPath;
    private final ImmutableList<Detector> releasePoints;
    public final String id;
    private final ImmutableList<TrackRangeView> trackRanges;

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("detectorPath", detectorPath)
                .add("releasePoints", releasePoints)
                .add("id", id)
                .add("trackRanges", trackRanges)
                .toString();
    }

    /** Constructor */
    public ReservationRouteImpl(
            ImmutableList<DiDetector> detectorPath,
            ImmutableList<Detector> releasePoints,
            String id,
            ImmutableList<TrackRangeView> trackRanges) {
        this.detectorPath = detectorPath;
        this.releasePoints = releasePoints;
        this.trackRanges = trackRanges;
        this.id = id;
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
        return trackRanges.stream()
                .mapToDouble(TrackRangeView::getLength)
                .sum();
    }
}
