package fr.sncf.osrd.new_infra.implementation.reservation;

import com.google.common.collect.ImmutableSet;
import fr.sncf.osrd.new_infra.api.reservation.DetectionSection;
import fr.sncf.osrd.new_infra.api.reservation.DiDetector;

public class DetectionSectionImpl implements DetectionSection {

    private final ImmutableSet<DiDetector> detectors;

    public DetectionSectionImpl(ImmutableSet<DiDetector> detectors) {
        this.detectors = detectors;
    }

    @Override
    public ImmutableSet<DiDetector> getDetectors() {
        return detectors;
    }
}
