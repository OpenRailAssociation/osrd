package fr.sncf.osrd.new_infra.implementation.reservation;

import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.reservation.DetectionSection;

public class DetectorImpl implements fr.sncf.osrd.new_infra.api.reservation.Detector {
    private final String id;
    private DetectionSection nextSection;
    private DetectionSection prevSection;

    public DetectorImpl(String id) {
        this.id = id;
    }

    @Override
    public String getID() {
        return id;
    }

    @Override
    public DetectionSection getNextDetectionSection(Direction direction) {
        if (direction == Direction.FORWARD)
            return nextSection;
        return prevSection;
    }

    void setDetectionSection(Direction direction, DetectionSection section) {
        if (direction == Direction.FORWARD)
            nextSection = section;
        prevSection = section;
    }

    @Override
    public String toString() {
        return String.format("Detector { id=%s }", id);
    }
}
