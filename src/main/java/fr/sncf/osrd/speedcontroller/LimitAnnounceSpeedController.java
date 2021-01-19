package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.TrainPhysicsIntegrator;
import fr.sncf.osrd.train.TrainState;

/**
 * The speed controller used to slow down the train from the announce of a speed limit up to its enforcement signal.
 */
public final class LimitAnnounceSpeedController extends RangeSpeedController {
    public final double targetSpeedLimit;

    public LimitAnnounceSpeedController(double targetSpeedLimit, double startPosition, double endPosition) {
        super(startPosition, endPosition);
        this.targetSpeedLimit = targetSpeedLimit;
    }

    @Override
    public Action getAction(
            TrainState state, TrainPhysicsIntegrator trainPhysics
    ) {
        return trainPhysics.actionToTargetSpeed(targetSpeedLimit, 0.5);
    }
}
