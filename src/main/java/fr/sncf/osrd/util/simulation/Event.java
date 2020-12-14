package fr.sncf.osrd.util.simulation;

import fr.sncf.osrd.util.simulation.core.AbstractEvent;
import fr.sncf.osrd.util.simulation.core.Simulation;
import fr.sncf.osrd.util.simulation.core.SimulationError;

public final class Event<T extends BaseT, WorldT, BaseT> extends AbstractEvent<T, WorldT, BaseT> {
    final EventSource<T, WorldT, BaseT> source;

    Event(
            Simulation<WorldT, BaseT> sim,
            double scheduledTime, T value,
            EventSource<T, WorldT, BaseT> source
    ) throws SimulationError {
        super(sim, scheduledTime, value);
        this.source = source;
    }

    @Override
    public void updateState(Simulation<WorldT, BaseT> sim, EventState newState) throws SimulationError {
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
