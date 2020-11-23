package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.Train;


public interface SpeedController {
    Action getAction(Train train, double timeDelta);
}
