package fr.sncf.osrd.simulation;

import fr.sncf.osrd.simulation.core.AbstractEvent;
import fr.sncf.osrd.simulation.core.Simulation;
import fr.sncf.osrd.simulation.core.SimulationError;

public final class Event<T extends BaseT, BaseT> extends AbstractEvent<T, BaseT> {
    final EventSource<T, BaseT> source;

    Event(Simulation<BaseT> sim, double scheduledTime, T value, EventSource<T, BaseT> source) throws SimulationError {
        super(sim, scheduledTime, value);
        this.source = source;
    }

    @Override
    public void updateState(Simulation<BaseT> sim, EventState newState) throws SimulationError {
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
            sink.feed(sim, this, newState);
        }
    }
}
