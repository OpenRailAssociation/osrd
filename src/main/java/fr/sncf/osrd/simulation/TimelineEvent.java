package fr.sncf.osrd.simulation;

import fr.sncf.osrd.utils.DeepComparable;

public abstract class TimelineEvent implements DeepComparable<TimelineEvent> {
    public final TimelineEventId eventId;

    public TimelineEvent(TimelineEventId eventId) {
        this.state = State.UNREGISTERED;
        this.eventId = eventId;
    }

    abstract void onOccurrence(Simulation sim) throws SimulationError;

    abstract void onCancellation(Simulation sim) throws SimulationError;

    /** The state of the event is only kept track of to enforce correct use of the API. */
    // region STATE_TRACKING

    private State state;

    void setState(State newState) {
        assert this.state.hasTransitionTo(newState);
        this.state = newState;
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
