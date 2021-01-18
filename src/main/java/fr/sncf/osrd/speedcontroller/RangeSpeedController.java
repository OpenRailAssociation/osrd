package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.train.*;

public abstract class RangeSpeedController extends SpeedController {
    private final double startPosition;
    private final double endPosition;

    public RangeSpeedController(double startPosition, double endPosition) {
        this.startPosition = startPosition;
        this.endPosition = endPosition;
    }

    @Override
    public boolean isActive(TrainState state) {
        var position = state.location.getHeadPathPosition();
        return (position >= startPosition && position < endPosition);
    }
}
