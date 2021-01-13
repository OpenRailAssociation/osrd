package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.train.*;


public interface SpeedController {
    Action getAction(TrainState train, TrainPhysicsIntegrator trainPhysics);
}
