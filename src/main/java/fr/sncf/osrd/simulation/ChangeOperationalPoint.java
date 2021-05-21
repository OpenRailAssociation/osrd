package fr.sncf.osrd.simulation;

import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.train.Train;

public class ChangeOperationalPoint extends Change {
    final Train train;
    final OperationalPoint op;

    /** Create a change to notify that a train is over an operational point */
    public ChangeOperationalPoint(Simulation sim, Train train, OperationalPoint op) {
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
