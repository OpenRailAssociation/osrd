package fr.sncf.osrd.infra;

import fr.sncf.osrd.infra.signaling.ActionPoint;
import fr.sncf.osrd.simulation.Change;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.InteractionType;
import fr.sncf.osrd.train.InteractionTypeSet;
import fr.sncf.osrd.train.Train;

public class StopActionPoint implements ActionPoint {

    private final int stopIndex;

    public StopActionPoint(int stopIndex) {
        this.stopIndex = stopIndex;
    }

    @Override
    public InteractionTypeSet getInteractionsType() {
        return new InteractionTypeSet(new InteractionType[]{InteractionType.HEAD});
    }

    @Override
    public double getActionDistance() {
        return 0;
    }

    @Override
    public String toString() {
        return String.format("StopActionPoint { index=%d }", stopIndex);
    }

    @Override
    public void interact(Simulation sim, Train train, InteractionType interactionType) throws SimulationError {
        var change = new StopReachedChange(sim, train, stopIndex);
        sim.publishChange(change);
    }

    public static class StopReachedChange extends Change {
        public final Train train;
        public final int stopIndex;

        /** Create a change to notify that a train has reached a stop */
        public StopReachedChange(Simulation sim, Train train, int stopIndex) {
            super(sim);
            this.train = train;
            this.stopIndex = stopIndex;
        }

        @Override
        public void replay(Simulation sim) {}

        @Override
        public String toString() {
            return String.format("StopChange { train: %s, stop index: %d }", train.getName(), stopIndex);
        }
    }
}
