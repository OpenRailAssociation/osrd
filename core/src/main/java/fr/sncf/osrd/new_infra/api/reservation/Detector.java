package fr.sncf.osrd.new_infra.api.reservation;

import fr.sncf.osrd.new_infra.api.Direction;

public interface Detector {
    /** Return the unique detector identifier */
    String getID();

    /** Returns the DetectionSection after the given direction */
    DetectionSection getNextDetectionSection(Direction direction);

    /** Directed detector instance linked to this detector */
    DiDetector getDiDetector(Direction direction);
}
