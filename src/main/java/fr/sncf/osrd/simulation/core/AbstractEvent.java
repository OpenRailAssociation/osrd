package fr.sncf.osrd.simulation.core;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.util.Objects;

public abstract class AbstractEvent<T extends BaseT, BaseT> implements Comparable<AbstractEvent<?, ?>> {
    public abstract void updateState(Simulation<BaseT> sim, EventState state) throws SimulationError;

    public enum EventState {
        // the event wasn't registered with the simulation
        UNREGISTERED(0),

        // the event hasn't happened yet, as its planned time is behind the simulation clock
        SCHEDULED(1),

        // the event got cancelled before it happened
        CANCELLED(2),
        // the event has happened
        HAPPENED(3),
        ;

        static {
            UNREGISTERED.validTransitions = new EventState[]{ EventState.SCHEDULED };
            SCHEDULED.validTransitions = new EventState[]{ EventState.CANCELLED, EventState.HAPPENED };
            CANCELLED.validTransitions = new EventState[]{ };
            HAPPENED.validTransitions = new EventState[]{ };
        }

        public final int id;
        private EventState[] validTransitions;

        EventState(int id) {
            this.id = id;
            this.validTransitions = null;
        }

        /**
         * Checks whether a state transition is valid.
         * @param newState the target state
         * @return whether the transition is valid
         */
        public boolean hasTransitionTo(EventState newState) {
            for (EventState validTransition : validTransitions)
                if (validTransition == newState)
                    return true;
            return false;
        }

        public boolean isFinalState() {
            return validTransitions.length == 0;
        }
    }

    protected EventState state;

    public EventState getState() {
        return state;
    }

    // some value associated with the event
    public final T value;

    // the simulation time the event is planned to execute at
    final double scheduledTime;

    // the revision of the simulation the event was created at
    // this is needed to enforce an absolute event order
    final long revision;

    /**
     * Creates a new event
     * @param sim the simulation the event belongs to
     * @param scheduledTime the time at will the event is planned to happen
     * @param value the value associated with the event
     * @throws SimulationError if a logic error occurs
     */
    public AbstractEvent(Simulation<BaseT> sim, double scheduledTime, T value) throws SimulationError {
        this.state = EventState.UNREGISTERED;
        this.scheduledTime = scheduledTime;
        this.revision = sim.nextRevision();
        this.value = value;
        sim.registerEvent(this);
    }

    @Override
    public int hashCode() {
        return Objects.hash(scheduledTime, revision);
    }

    @Override
    @SuppressFBWarnings(value = "FE_FLOATING_POINT_EQUALITY")
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (getClass() != obj.getClass())
            return false;

        // because of type erasure, we can't cast to the exact type
        AbstractEvent<?, ?> o = (AbstractEvent<?, ?>) obj;
        return scheduledTime == o.scheduledTime && revision == o.revision;
    }

    @Override
    public int compareTo(AbstractEvent<?, ?> o) {
        assert this.state == EventState.SCHEDULED;
        assert o.state == EventState.SCHEDULED;

        // events are compared by planned time first, then revision
        int cmpRes = Double.compare(scheduledTime, o.scheduledTime);
        if (cmpRes != 0)
            return cmpRes;

        return Long.compare(revision, o.revision);
    }
}
