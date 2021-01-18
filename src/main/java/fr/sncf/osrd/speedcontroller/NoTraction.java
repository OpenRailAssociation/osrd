package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.train.*;

public final class NoTraction extends RangeSpeedController {
    public NoTraction(double startPosition, double endPosition) {
        super(startPosition, endPosition);
    }

    @Override
    public Action getAction(TrainState state, TrainPhysicsIntegrator trainPhysics) {
        return Action.coast();
    }
}