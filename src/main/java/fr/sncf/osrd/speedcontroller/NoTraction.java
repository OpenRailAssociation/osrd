package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.Train;

public class NoTraction extends RangeSpeedController {
    public NoTraction(double startPosition, double endPosition) {
        super(startPosition, endPosition);
    }

    @Override
    Action getActionOnRange(Train train, double deltaTime) {
        return Action.accelerate(0, false);
    }
}