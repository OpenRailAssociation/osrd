package fr.sncf.osrd.simulation.utils;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.util.Objects;

/**
 * A base event type. Derived types implement updateState to notify some other components about changes.
 * @param <T> the type of the value
 */
public class TimelineEvent<T extends BaseChange> implements Comparable<TimelineEvent<?>> {
    public final Entity source;

    void updateState(Simulation sim, State newState) throws SimulationError {
        assert this.state.hasTransitionTo(newState);
        this.state = newState;

        switch (newState) {
            case UNREGISTERED:
                throw new SimulationError("updated an event's state to UNINITIALIZED");
                // event sinks don't need to be notified when the event is scheduled
            case SCHEDULED:
                return;

            // for now, notify subscribers for these two states
            case HAPPENED:
            case CANCELLED:
                break;
        }

        for (var sink : source.subscribers) {
            sink.timelineEventUpdate(sim, this, newState);
        }
    }

    public enum State {
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
            UNREGISTERED.validTransitions = new State[]{ State.SCHEDULED };
            SCHEDULED.validTransitions = new State[]{ State.CANCELLED, State.HAPPENED };
            CANCELLED.validTransitions = new State[]{ };
            HAPPENED.validTransitions = new State[]{ };
        }

        public final int id;
        private State[] validTransitions;

        State(int id) {
            this.id = id;
            this.validTransitions = null;
        }

        /**
         * Checks whether a state transition is valid.
         * @param newState the target state
         * @return whether the transition is valid
         */
        public boolean hasTransitionTo(State newState) {
            for (State validTransition : validTransitions)
                if (validTransition == newState)
                    return true;
            return false;
        }

        public boolean isFinalState() {
            return validTransitions.length == 0;
        }
    }

    protected State state;

    public State getState() {
        return state;
    }

    // some value associated with the event
    public final T value;

    // the simulation time the event is planned to execute at
    public final double scheduledTime;

    // the revision of the simulation the event was created at
    // this is needed to enforce an absolute event order
    final long revision;

    /**
     * Creates a new event
     *
     * @param source the entity the event was generated from
     * @param sim the simulation the event belongs to
     * @param scheduledTime the time at will the event is planned to happen
     * @param value the value associated with the event
     * @throws SimulationError {@inheritDoc}
     */
    public TimelineEvent(Entity source, Simulation sim, double scheduledTime, T value) throws SimulationError {
        this.source = source;
        this.state = State.UNREGISTERED;
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
        TimelineEvent<?> o = (TimelineEvent<?>) obj;
        return scheduledTime == o.scheduledTime && revision == o.revision;
    }

    @Override
    public int compareTo(TimelineEvent<?> o) {
        assert this.state == State.SCHEDULED;
        assert o.state == State.SCHEDULED;

        // events are compared by planned time first, then revision
        int cmpRes = Double.compare(scheduledTime, o.scheduledTime);
        if (cmpRes != 0)
            return cmpRes;

        return Long.compare(revision, o.revision);
    }
}
