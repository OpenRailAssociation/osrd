package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPhysicsSimulator;
import fr.sncf.osrd.train.TrainPositionTracker;

public abstract class RangeSpeedController implements SpeedController {
    private final double startPosition;
    private final double endPosition;

    public RangeSpeedController(double startPosition, double endPosition) {
        this.startPosition = startPosition;
        this.endPosition = endPosition;
    }

    abstract Action getActionOnRange(Train train, TrainPositionTracker location, TrainPhysicsSimulator trainPhysics);

    @Override
    public Action getAction(Train train, TrainPositionTracker location, TrainPhysicsSimulator trainPhysics) {
        if (location.getHeadPathPosition() < startPosition)
            // don't do anything, but don't delete the controller
            return Action.empty(false);
        if (location.getHeadPathPosition() > endPosition)
            // don't do anything and ditch the controller
            return Action.empty(true);
        return getActionOnRange(train, location, trainPhysics);
    }
}
