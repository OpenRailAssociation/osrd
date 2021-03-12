package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.Train;

public class Detector extends Waypoint {

    public Detector(int index, String id) {
        super(index, id);
    }

    @Override
    public void interact(Simulation sim, Train train) {
        // TODO
    }
}
