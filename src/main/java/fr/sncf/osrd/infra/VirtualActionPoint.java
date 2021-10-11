package fr.sncf.osrd.infra;

import fr.sncf.osrd.infra.signaling.ActionPoint;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.InteractionType;
import fr.sncf.osrd.train.InteractionTypeSet;
import fr.sncf.osrd.train.Train;

public class VirtualActionPoint implements ActionPoint {
    public final String name;

    public VirtualActionPoint(String name) {
        this.name = name;
    }

    @Override
    public InteractionTypeSet getInteractionsType() {
        return new InteractionTypeSet(new InteractionType[]{InteractionType.HEAD});
    }

    @Override
    public double getSightDistance() {
        return 0;
    }

    @Override
    public void interact(Simulation sim, Train train, InteractionType interactionType) throws SimulationError {}
}
