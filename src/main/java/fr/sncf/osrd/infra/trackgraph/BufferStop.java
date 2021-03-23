package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainInteractionType;

/**
 * A stop block prevents trains from going past the end of a track.
 * https://en.wikipedia.org/wiki/Buffer_stop
 */
public class BufferStop extends Waypoint {

    public BufferStop(int index, String id) {
        super(index, id);
    }

    @Override
    public TrainInteractionType getInteractionType() {
        return TrainInteractionType.HEAD;
    }

    @Override
    public double getActionDistance() {
        return 0;
    }

    @Override
    public void interact(Simulation sim, Train train, TrainInteractionType interactionType) {
        // TODO
    }
}
