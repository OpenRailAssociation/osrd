package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainInteractionType;

public class Detector extends Waypoint {

    public Detector(int index, String id) {
        super(index, id);
    }

    @Override
    public TrainInteractionType getInteractionType() {
        return TrainInteractionType.BOTH;
    }

    @Override
    public double getActionDistance() {
        return 0;
    }

    @Override
    public void interact(Simulation sim, Train train, TrainInteractionType interactionType) {
        train.interact(sim, this, interactionType);
    }

    @Override
    public String toString() {
        return String.format("Detector { id=%s }", id);
    }
}
