package fr.sncf.osrd.new_infra.api.reservation;

import com.google.common.collect.ImmutableSet;

/** It's the same as a zone, or a track vacancy detection section (TVDSection) */
public interface DetectionSection {
    ImmutableSet<DiDetector> getDetectors();
}
