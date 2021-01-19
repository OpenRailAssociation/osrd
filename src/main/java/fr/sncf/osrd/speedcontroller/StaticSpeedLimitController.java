package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.TrainPhysicsIntegrator;
import fr.sncf.osrd.train.TrainState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class StaticSpeedLimitController extends SpeedController {
    static final Logger logger = LoggerFactory.getLogger(StaticSpeedLimitController.class);

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

        if (state.speed > maxSpeed) {
            logger.warn("train {} exceeded hard speed limit {}", state.train.name, maxSpeed);
            return Action.emergencyBrake();
        }

        return Action.coast();
    }
}
