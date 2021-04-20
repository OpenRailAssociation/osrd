package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.InteractionType;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.InteractionTypeSet;

public class Detector extends Waypoint {

    private static final InteractionTypeSet interactionTypeSet =
            new InteractionTypeSet(new InteractionType[]{InteractionType.HEAD, InteractionType.TAIL});

    public Detector(int index, String id) {
        super(index, id);
    }

    @Override
    public InteractionTypeSet getInteractionsType() {
        return interactionTypeSet;
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
