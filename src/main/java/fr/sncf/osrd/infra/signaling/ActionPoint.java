package fr.sncf.osrd.infra.signaling;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.InteractionType;
import fr.sncf.osrd.train.InteractionTypeSet;
import fr.sncf.osrd.train.Train;

public interface ActionPoint {
    InteractionTypeSet getInteractionsType();

    /** Gets the distance at the object can be seen */
    double getSightDistance();

    /**
     * A method called by a train when its head arrives on it.
     * @param sim the simulation
     * @param train the train arriving on the sensor
     */
    void interact(Simulation sim, Train train, InteractionType interactionType) throws SimulationError;
}
