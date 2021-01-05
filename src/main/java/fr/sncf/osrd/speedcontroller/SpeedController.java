package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.train.*;


public interface SpeedController {
    Action getAction(TrainState train, TrainPositionTracker location, TrainPhysicsSimulator trainPhysics);
}
