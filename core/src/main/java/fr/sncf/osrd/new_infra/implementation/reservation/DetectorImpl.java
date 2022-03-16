package fr.sncf.osrd.new_infra.implementation.reservation;

import com.google.common.base.MoreObjects;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.Maps;
import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.reservation.DetectionSection;
import fr.sncf.osrd.new_infra.api.reservation.Detector;
import fr.sncf.osrd.new_infra.api.reservation.DiDetector;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.Map;

public class DetectorImpl implements Detector {
    private final String id;
    private DetectionSection nextSection;
    private DetectionSection prevSection;
    private ImmutableMap<Direction, DiDetector> diDetectors = null;

    /**
     * Constructor
     */
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

    @Override
    public DiDetector getDiDetector(Direction direction) {
        return diDetectors.get(direction);
    }

    /**
     * Sets the next detection section toward the given direction (package private)
     */
    void setDetectionSection(Direction direction, DetectionSection section) {
        if (direction == Direction.FORWARD)
            nextSection = section;
        else
            prevSection = section;
    }

    /**
     * Sets the directed detectors (package private)
     */
    void setDiDetectors(Map<Direction, DiDetector> diDetectors) {
        this.diDetectors = Maps.immutableEnumMap(diDetectors);
    }

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("id", id)
                .toString();
    }
}
