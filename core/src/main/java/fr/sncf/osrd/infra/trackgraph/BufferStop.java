package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.InteractionType;
import fr.sncf.osrd.train.InteractionTypeSet;
import fr.sncf.osrd.train.Train;

/**
 * A stop block prevents trains from going past the end of a track.
 * https://en.wikipedia.org/wiki/Buffer_stop
 */
public class BufferStop extends Waypoint {
    private static final InteractionTypeSet interactionTypeSet = new InteractionTypeSet();

    public BufferStop(int index, String id) {
        super(index, id);
    }

    @Override
    public InteractionTypeSet getInteractionsType() {
        return interactionTypeSet;
    }

    @Override
    public double getSightDistance() {
        return 0;
    }

    @Override
    public void interact(Simulation sim, Train train, InteractionType interactionType) {
        // TODO
    }

    @Override
    public String toString() {
        return String.format("BufferStop { id=%s }", id);
    }
}
