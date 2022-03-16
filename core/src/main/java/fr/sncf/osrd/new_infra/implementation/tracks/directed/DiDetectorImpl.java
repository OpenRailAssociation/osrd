package fr.sncf.osrd.new_infra.implementation.tracks.directed;

import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.reservation.Detector;
import fr.sncf.osrd.new_infra.api.reservation.DiDetector;
import fr.sncf.osrd.new_infra.implementation.BaseAttributes;

public class DiDetectorImpl extends BaseAttributes implements DiDetector {
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
    public String toString() {
        return String.format("DiDetector { detector=%s, direction=%s }", detector, direction);
    }

}
