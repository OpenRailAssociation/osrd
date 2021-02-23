package fr.sncf.osrd.infra.interlocking;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.TrainState;

public interface VisibleTrackObject {
    /**
     * Returns the distance at which this object can be seen by a train.
     * @return the distance at which this object can be seen by a train.
     */
    double getSightDistance();

    /**
     * A function called by a train when it first sees this object.
     * @param sim the simulation
     * @param trainState the train seeing the object
     * @param trainObjectDistance the distance between the train and the object
     */
    void onSight(Simulation sim, TrainState trainState, double trainObjectDistance);
}
