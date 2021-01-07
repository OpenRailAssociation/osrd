package fr.sncf.osrd.simulation.utils;

public abstract class Change {
    public enum State {
        // the simulation doesn't yet know about this change
        UNREGISTERED,
        // the simulation knows about this change, but the change wasn't yet deemed ready
        REGISTERED,
        // the change was sent to the change log (event store)
        PUBLISHED,
    }

    public State state = State.UNREGISTERED;

    protected Change(Simulation sim) {
        sim.onChangeCreated(this);
    }

    public abstract void replay(Simulation sim);
}
