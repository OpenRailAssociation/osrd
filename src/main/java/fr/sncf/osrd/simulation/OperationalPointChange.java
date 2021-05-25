package fr.sncf.osrd.simulation;

import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.train.Train;

public class OperationalPointChange extends Change {
    public final Train train;
    public final OperationalPoint op;

    /** Create a change to notify that a train is over an operational point */
    public OperationalPointChange(Simulation sim, Train train, OperationalPoint op) {
        super(sim);
        this.train = train;
        this.op = op;
    }

    @Override
    public void replay(Simulation sim) {}

    @Override
    public String toString() {
        return String.format("OperationalPointChange { train: %s, op: %s }", train.getName(), op.id);
    }
}
