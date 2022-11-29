package fr.sncf.osrd.infra.api.reservation;

import com.google.common.collect.ImmutableSet;
import fr.sncf.osrd.infra.api.tracks.undirected.Switch;

/** It's the same as a zone, or a track vacancy detection section (TVDSection) */
public interface DetectionSection {
    /** Returns all the switches contained in the track section */
    ImmutableSet<Switch> getSwitches();

    /** Returns all the detectors bordering the section. The direction points toward the inside of the section */
    ImmutableSet<DiDetector> getDetectors();

    /** Returns all the routes crossing over this section */
    ImmutableSet<ReservationRoute> getRoutes();
}
