package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.train.*;

public class NoTraction extends RangeSpeedController {
    public NoTraction(double startPosition, double endPosition) {
        super(startPosition, endPosition);
    }

    @Override
    Action getActionOnRange(TrainState train, TrainPositionTracker location, TrainPhysicsSimulator trainPhysics) {
        return Action.accelerate(0, false);
    }
}