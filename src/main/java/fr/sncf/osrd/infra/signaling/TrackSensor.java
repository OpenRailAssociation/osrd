package fr.sncf.osrd.infra.signaling;

import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.simulation.Simulation;

public interface TrackSensor {
    /**
     * A method called by a train when its head arrives on this sensor.
     * @param sim the simulation
     * @param train the train arriving on the sensor
     */
    void onTrainArrival(Simulation sim, Train train);

    /**
     * A method called by a train when its tail leaves this sensor.
     * @param sim the simulation
     * @param train the train leaving on the sensor
     */
    void onTrainDeparture(Simulation sim, Train train);
}
