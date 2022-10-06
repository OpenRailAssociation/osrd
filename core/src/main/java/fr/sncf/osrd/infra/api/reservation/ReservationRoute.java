package fr.sncf.osrd.infra.api.reservation;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import fr.sncf.osrd.infra.api.tracks.undirected.Detector;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;

public interface ReservationRoute {
    /** Returns the route id */
    String getID();

    /** Returns the path the route takes in the detector graph */
    ImmutableList<DiDetector> getDetectorPath();

    /** Returns the points of the detector path at which the previous detection sections shall be released */
    ImmutableList<Detector> getReleasePoints();

    /** Returns the list of conflicting routes */
    ImmutableSet<ReservationRoute> getConflictingRoutes();

    /** Returns the list of track ranges on the route */
    ImmutableList<TrackRangeView> getTrackRanges();

    /** Returns the list of track ranges on the route from begin offset to end offset
     * (relative to the start of the route) */
    ImmutableList<TrackRangeView> getTrackRanges(double beginOffset, double endOffset);

    /** Returns the route length (m) */
    double getLength();

    /** Returns true if the route is controlled (needs to be requested) */
    boolean isControlled();

    /** Returns the entry detector of this route */
    default DiDetector getEntryDetector() {
        return getDetectorPath().get(0);
    }

    /** Returns the exit detector of this route */
    default DiDetector getExitDetector() {
        var path = getDetectorPath();
        return path.get(path.size() - 1);
    }
}
