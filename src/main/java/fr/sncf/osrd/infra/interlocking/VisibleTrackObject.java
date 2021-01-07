package fr.sncf.osrd.infra.interlocking;

import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.simulation.utils.Simulation;

public interface VisibleTrackObject {
    /**
     * Returns the distance at which this object can be seen by a train.
     * @return the distance at which this object can be seen by a train.
     */
    double getSightDistance();

    /**
     * A function called by a train when it first sees this object.
     * @param sim the simulation
     * @param train the train seeing the object
     */
    void onSight(Simulation sim, Train train);
}
