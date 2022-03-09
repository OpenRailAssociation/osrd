package fr.sncf.osrd.new_infra.api.reservation;

import com.google.common.collect.ImmutableList;

public interface ReservationRoute {
    /** Returns the path the route takes in the detector graph */
    ImmutableList<DiDetector> getDetectorPath();

    /** Returns the points of the detector path at which the previous detection sections shall be released */
    ImmutableList<Detector> getReleasePoints();

    /** Returns the list of conflicting routes */
    ImmutableList<ReservationRoute> getConflictingRoutes();
}
