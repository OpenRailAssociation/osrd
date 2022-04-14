package fr.sncf.osrd.infra.api.reservation;

import com.google.common.collect.ImmutableSet;

/** It's the same as a zone, or a track vacancy detection section (TVDSection) */
public interface DetectionSection {
    /** Returns all the detectors bordering the section. The direction points toward the inside of the section */
    ImmutableSet<DiDetector> getDetectors();
}
