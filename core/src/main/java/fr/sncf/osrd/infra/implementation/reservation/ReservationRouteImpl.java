package fr.sncf.osrd.infra.implementation.reservation;

import com.google.common.base.MoreObjects;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import fr.sncf.osrd.infra.api.reservation.DetectionSection;
import fr.sncf.osrd.infra.api.reservation.DiDetector;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.infra.api.tracks.undirected.Detector;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;

public class ReservationRouteImpl implements ReservationRoute {
    private final ImmutableList<DetectionSection> detectionSections;
    private ImmutableSet<ReservationRoute> conflictingRoutes = null;
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
            double length,
            ImmutableList<DetectionSection> sections
    ) {
        this.detectorPath = detectorPath;
        this.releasePoints = releasePoints;
        this.trackRanges = trackRanges;
        this.id = id;
        this.isControlled = isControlled;
        this.length = length;
        this.detectionSections = sections;
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
        // Lazy evaluation
        if (conflictingRoutes == null)
            conflictingRoutes = buildConflictingRoutes();
        return conflictingRoutes;
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

    private ImmutableSet<ReservationRoute> buildConflictingRoutes() {
        var builder = ImmutableSet.<ReservationRoute>builder();
        for (var section : detectionSections) {
            for (var route : section.getRoutes())
                if (route != this)
                    builder.add(route);
        }
        return builder.build();
    }
}
