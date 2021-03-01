package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.Train;

public class Detector extends Waypoint {

    public Detector(String id) {
        super(id);
    }

    @Override
    public void onTrainArrival(Simulation sim, Train train) {
        // TODO
    }

    @Override
    public void onTrainDeparture(Simulation sim, Train train) {
        // TODO
    }
}
