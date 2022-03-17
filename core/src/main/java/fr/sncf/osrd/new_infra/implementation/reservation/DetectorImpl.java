package fr.sncf.osrd.new_infra.implementation.reservation;

import com.google.common.base.MoreObjects;
import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.reservation.DetectionSection;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;

public class DetectorImpl implements fr.sncf.osrd.new_infra.api.reservation.Detector {
    private final String id;
    private DetectionSection nextSection;
    private DetectionSection prevSection;

    /** Constructor */
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

    /** Sets the next detection section toward the given direction (package private) */
    void setDetectionSection(Direction direction, DetectionSection section) {
        if (direction == Direction.FORWARD)
            nextSection = section;
        prevSection = section;
    }

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("id", id)
                .toString();
    }
}
