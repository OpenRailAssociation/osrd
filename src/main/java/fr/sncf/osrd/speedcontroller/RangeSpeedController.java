package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.train.*;

public abstract class RangeSpeedController implements SpeedController {
    private final double startPosition;
    private final double endPosition;

    public RangeSpeedController(double startPosition, double endPosition) {
        this.startPosition = startPosition;
        this.endPosition = endPosition;
    }

    abstract Action getActionOnRange(
            TrainState state,
            TrainPhysicsIntegrator trainPhysics
    );

    @Override
    public Action getAction(TrainState state, TrainPhysicsIntegrator trainPhysics) {
        if (state.location.getHeadPathPosition() < startPosition)
            // don't do anything, but don't delete the controller
            return Action.empty(false);
        if (state.location.getHeadPathPosition() > endPosition)
            // don't do anything and ditch the controller
            return Action.empty(true);
        return getActionOnRange(state, trainPhysics);
    }
}
