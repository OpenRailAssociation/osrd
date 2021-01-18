package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.train.*;

public abstract class SpeedController {
    public boolean isActive(TrainState train) {
        return true;
    }

    /**
     * Returns the speed instructed by this controller.
     * Nan means coasting
     * @param state the state of the train
     * @param trainPhysics the physics simulation toolkit for the train
     * @return the speed limit at this point
     */
    public abstract Action getAction(TrainState state, TrainPhysicsIntegrator trainPhysics);
}
