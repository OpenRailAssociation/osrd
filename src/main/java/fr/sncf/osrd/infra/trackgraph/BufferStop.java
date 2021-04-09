package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.InteractionType;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.InteractionsType;

/**
 * A stop block prevents trains from going past the end of a track.
 * https://en.wikipedia.org/wiki/Buffer_stop
 */
public class BufferStop extends Waypoint {
    private static final InteractionsType interactionsType = new InteractionsType();

    public BufferStop(int index, String id) {
        super(index, id);
    }

    @Override
    public InteractionsType getInteractionsType() {
        return interactionsType;
    }

    @Override
    public double getActionDistance() {
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
