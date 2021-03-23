package fr.sncf.osrd.simulation;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.utils.DeepComparable;

/**
 * A base event type. Derived types implement updateState to notify some other components about changes.
 * @param <T> the type of the value
 */
// even though this warning is ignored, it is sort of correct:
// timeline events are equal when their identifier is.
// **it does not check for the exact content of the timeline event**
@SuppressFBWarnings({"EQ_DOESNT_OVERRIDE_EQUALS"})
public final class TimelineEvent<T extends TimelineEventValue> extends TimelineEventId
        implements DeepComparable<TimelineEvent<?>> {
    public final Entity<?> source;

    // some value associated with the event
    public final T value;

    void onScheduled() {
        setState(State.SCHEDULED);
    }

    void onOccurrence(Simulation sim) throws SimulationError {
        setState(State.OCCURRED);
        for (var subscriber : source.getSubscribers())
            subscriber.onEventOccurred(sim, this);
    }

    void onCancellation(Simulation sim) throws SimulationError {
        setState(State.CANCELLED);
        for (var subscriber : source.getSubscribers())
            subscriber.onEventCancelled(sim, this);
    }

    /**
     * Creates a new event
     *
     * @param source the entity the event was generated from
     * @param revision the revision of the event
     * @param scheduledTime the time at will the event is planned to happen
     * @param value the value associated with the event
     */
    TimelineEvent(Entity<?> source, long revision, double scheduledTime, T value) {
        super(scheduledTime, revision);
        this.source = source;
        this.state = State.UNREGISTERED;
        this.value = value;
    }

    /** The state of the event is only kept track of to enforce correct use of the API. */
    // region STATE_TRACKING

    private State state;

    private void setState(State newState) {
        assert this.state.hasTransitionTo(newState);
        this.state = newState;
    }

    @Override
    public boolean deepEquals(TimelineEvent<?> other) {
        if (!super.equals(other))
            return false;
        if (!value.deepEquals(other.value))
            return false;
        if (!source.getID().equals(other.source.getID()))
            return false;
        return false;
    }

    public enum State {
        // the event wasn't registered with the simulation
        UNREGISTERED(0),

        // the event hasn't happened yet, as its planned time is behind the simulation clock
        SCHEDULED(1),

        // the event got cancelled before it happened
        CANCELLED(2),
        // the event has happened
        OCCURRED(3),
        ;

        static {
            UNREGISTERED.validTransitions = new State[]{ State.SCHEDULED };
            SCHEDULED.validTransitions = new State[]{ State.CANCELLED, State.OCCURRED};
            CANCELLED.validTransitions = new State[]{ };
            OCCURRED.validTransitions = new State[]{ };
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
    }

    // endregion
}
