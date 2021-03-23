package fr.sncf.osrd.infra.signaling;

import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.TrainInteractionType;

public interface ActionPoint {
    TrainInteractionType getInteractionType();

    /** Gets the distance from the object at which the action occurs */
    double getActionDistance();

    /**
     * A method called by a train when its head arrives on it.
     * @param sim the simulation
     * @param train the train arriving on the sensor
     */
    void interact(Simulation sim, Train train, TrainInteractionType actionType);
}
