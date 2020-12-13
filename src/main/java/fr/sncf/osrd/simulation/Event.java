package fr.sncf.osrd.simulation;

public final class Event<T extends BaseT, BaseT> extends AbstractEvent<T, BaseT> {
    final EventSource<T, BaseT> source;

    Event(double scheduledTime, long revision, T value, EventSource<T, BaseT> source) {
        super(scheduledTime, revision, value);
        this.source = source;
    }

    @Override
    void updateState(Simulation<BaseT> sim, EventState newState) throws SimulationError {
        assert this.state.hasTransitionTo(newState);
        this.state = newState;

        switch (newState) {
            // event sinks don't need to be notified when the event is scheduled
            case SCHEDULED:
                return;
            case UNINITIALIZED:
                throw new SimulationError("updated an event's state to UNINITIALIZED");

            // for now, notify subscribers for these two states
            case HAPPENED:
            case CANCELLED:
                break;
        }

        for (var sink : source.subscribers) {
            sink.feed(sim, this, newState);
        }
    }
}
