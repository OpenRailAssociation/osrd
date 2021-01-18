package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.TrainPhysicsIntegrator;
import fr.sncf.osrd.train.TrainState;

public final class StaticSpeedLimitController extends SpeedController {
    @Override
    public Action getAction(
            TrainState state, TrainPhysicsIntegrator trainPhysics
    ) {
        var maxSpeed = state.location
                // get the list of speed limits under the train
                // for example:
                // +----------------------------------+
                // |                                   \
                // +------------------------------------+
                // 0                                    200
                //
                // [0, 50[ -> value (speed limit) is 120
                // [50, 200[ -> value (speed limit) is 200
                .streamRangeAttrUnderTrain(TopoEdge::getSpeedLimit)
                // discard the bounds of the speed limits, keeping only the numerical value
                .map(rangeValue -> rangeValue.value)
                // keep the minimum speed limit under the train
                .reduce(Double::min)
                // if no speed limit was found, it's +infinity
                .orElse(Double.POSITIVE_INFINITY);

        // compute the action to apply in order to maintain some speed
        return trainPhysics.actionToTargetSpeed(maxSpeed);
    }
}
