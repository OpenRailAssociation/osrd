package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPhysicsSimulator;
import fr.sncf.osrd.train.TrainPositionTracker;

public class NoTraction extends RangeSpeedController {
    public NoTraction(double startPosition, double endPosition) {
        super(startPosition, endPosition);
    }

    @Override
    Action getActionOnRange(Train train, TrainPositionTracker location, TrainPhysicsSimulator trainPhysics) {
        return Action.accelerate(0, false);
    }
}