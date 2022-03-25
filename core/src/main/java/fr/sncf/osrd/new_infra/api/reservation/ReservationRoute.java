package fr.sncf.osrd.new_infra.api.reservation;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import fr.sncf.osrd.new_infra.api.tracks.undirected.Detector;
import fr.sncf.osrd.new_infra.implementation.tracks.directed.TrackRangeView;

public interface ReservationRoute {
    /** Returns the route id */
    String getID();

    /** Returns the path the route takes in the detector graph */
    ImmutableList<DiDetector> getDetectorPath();

    /** Returns the points of the detector path at which the previous detection sections shall be released */
    ImmutableList<Detector> getReleasePoints();

    /** Returns the list of conflicting routes */
    ImmutableSet<ReservationRoute> getConflictingRoutes();

    /** Returns the list of track ranges on the route*/
    ImmutableList<TrackRangeView> getTrackRanges();

    /** Returns the route length (m) */
    double getLength();
}
