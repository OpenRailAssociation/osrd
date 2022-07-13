package fr.sncf.osrd.infra.api.tracks.undirected;

import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.reservation.DetectionSection;
import fr.sncf.osrd.infra.api.reservation.DiDetector;

/** A detector or buffer stop */
public interface Detector {
    /** Returns the track section this object is on */
    TrackSection getTrackSection();

    /** Returns the offset of the object inside the track section */
    double getOffset();

    /** Returns the ID of the object */
    String getID();

    /** Returns true if the object is a buffer stop */
    boolean isBufferStop();

    /** Returns the DetectionSection after the given direction */
    DetectionSection getNextDetectionSection(Direction direction);

    /** Directed detector instance linked to this detector */
    DiDetector getDiDetector(Direction direction);
}
