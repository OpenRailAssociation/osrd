package fr.sncf.osrd.simulation;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

/**
 * A base event type. Derived types implement updateState to notify some other components about changes.
 * @param <T> the type of the value
 */
// even though this warning is ignored, it is sort of correct:
// timeline events are equal when their identifier is.
// **it does not check for the exact content of the timeline event**
@SuppressFBWarnings({"EQ_DOESNT_OVERRIDE_EQUALS"})
public class TimelineEvent<T extends TimelineEventValue> extends TimelineEventId {
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

        for (var subscriber : source.subscribers)
            subscriber.onTimelineEventUpdate(sim, this, newState);
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

    /**
     * Creates a new event
     *
     * @param source the entity the event was generated from
     * @param revision the revision of the event
     * @param scheduledTime the time at will the event is planned to happen
     * @param value the value associated with the event
     */
    TimelineEvent(Entity source, long revision, double scheduledTime, T value) {
        super(scheduledTime, revision);
        this.source = source;
        this.state = State.UNREGISTERED;
        this.value = value;
    }
}
