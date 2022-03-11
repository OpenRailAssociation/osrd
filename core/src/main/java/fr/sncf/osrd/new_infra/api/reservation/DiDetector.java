package fr.sncf.osrd.new_infra.api.reservation;

import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.WithAttributes;

public interface DiDetector extends WithAttributes {

    /** Returns the detector */
    Detector getDetector();

    /** Returns the direction on the TrackEdge */
    Direction getDirection();
}
