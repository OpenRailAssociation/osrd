package fr.sncf.osrd.infra.interlocking;

import fr.sncf.osrd.simulation.BaseChange;
import fr.sncf.osrd.simulation.World;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.util.simulation.core.Simulation;

public interface TrackSensor {
    /**
     * A method called by a train when its head arrives on this sensor.
     * @param sim the simulation
     * @param train the train arriving on the sensor
     */
    void onTrainArrival(Simulation<World, BaseChange> sim, Train train);

    /**
     * A method called by a train when its tail leaves this sensor.
     * @param sim the simulation
     * @param train the train leaving on the sensor
     */
    void onTrainDeparture(Simulation<World, BaseChange> sim, Train train);
}
