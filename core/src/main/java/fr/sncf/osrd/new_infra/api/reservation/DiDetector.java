package fr.sncf.osrd.new_infra.api.reservation;

import fr.sncf.osrd.new_infra.api.Direction;

public interface DiDetector {

    /** Returns the detector */
    Detector getDetector();

    /** Returns the direction on the TrackEdge */
    Direction getDirection();
}
