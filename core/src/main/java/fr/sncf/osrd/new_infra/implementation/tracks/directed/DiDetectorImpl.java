package fr.sncf.osrd.new_infra.implementation.tracks.directed;

import com.google.common.base.MoreObjects;
import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.reservation.Detector;
import fr.sncf.osrd.new_infra.api.reservation.DiDetector;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;

public class DiDetectorImpl implements DiDetector {
    private final Detector detector;
    private final Direction direction;

    public DiDetectorImpl(Detector detector, Direction direction) {
        this.detector = detector;
        this.direction = direction;
    }

    @Override
    public Detector getDetector() {
        return detector;
    }

    @Override
    public Direction getDirection() {
        return direction;
    }

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("detector", detector)
                .add("direction", direction)
                .toString();
    }
}
