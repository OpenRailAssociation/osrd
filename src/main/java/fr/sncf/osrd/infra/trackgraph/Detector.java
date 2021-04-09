package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.InteractionType;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.InteractionsType;

public class Detector extends Waypoint {

    private static final InteractionsType interactionsType =
            new InteractionsType(new InteractionType[]{InteractionType.HEAD, InteractionType.TAIL});

    public Detector(int index, String id) {
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
    public void interact(Simulation sim, Train train, InteractionType interactionType) throws SimulationError {
        train.interact(sim, this, interactionType);
    }

    @Override
    public String toString() {
        return String.format("Detector { id=%s }", id);
    }
}
