package fr.sncf.osrd.new_infra.implementation.reservation;

import com.google.common.collect.ImmutableSet;
import fr.sncf.osrd.new_infra.api.reservation.DetectionSection;
import fr.sncf.osrd.new_infra.api.reservation.DiDetector;
import java.util.StringJoiner;

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
    public String toString() {
        var builder = new StringJoiner(", ", "DetectionSection { ", " }");
        for (var d : detectors)
            builder.add(d.toString());
        return builder.toString();
    }
}
