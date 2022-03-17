package fr.sncf.osrd.new_infra.implementation.reservation;

import com.google.common.base.MoreObjects;
import com.google.common.collect.ImmutableSet;
import fr.sncf.osrd.new_infra.api.reservation.DetectionSection;
import fr.sncf.osrd.new_infra.api.reservation.DiDetector;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;

public class DetectionSectionImpl implements DetectionSection {

    private final ImmutableSet<DiDetector> detectors;

    /** Constructor */
    public DetectionSectionImpl(ImmutableSet<DiDetector> detectors) {
        this.detectors = detectors;
    }

    @Override
    public ImmutableSet<DiDetector> getDetectors() {
        return detectors;
    }

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("detectors", detectors)
                .toString();
    }
}
