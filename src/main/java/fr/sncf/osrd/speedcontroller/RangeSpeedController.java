package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.Train;

public abstract class RangeSpeedController implements SpeedController {
    private final double startPosition;
    private final double endPosition;

    public RangeSpeedController(double startPosition, double endPosition) {
        this.startPosition = startPosition;
        this.endPosition = endPosition;
    }

    abstract Action getActionOnRange(Train train, double deltaTime);

    @Override
    public Action getAction(Train train, double deltaTime) {
        if (train.positionTracker.getHeadPathPosition() < startPosition)
            return Action.empty(false);
        if (train.positionTracker.getHeadPathPosition() > endPosition)
            return Action.empty(true);
        return getActionOnRange(train, deltaTime);
    }
}
