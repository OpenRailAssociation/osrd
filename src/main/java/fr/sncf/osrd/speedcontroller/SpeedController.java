package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPhysicsSimulator;
import fr.sncf.osrd.train.TrainPositionTracker;


public interface SpeedController {
    Action getAction(Train train, TrainPositionTracker location, TrainPhysicsSimulator trainPhysics);
}
