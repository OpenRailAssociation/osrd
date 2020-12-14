package fr.sncf.osrd.util.simulation;

import fr.sncf.osrd.util.simulation.core.AbstractEvent;
import fr.sncf.osrd.util.simulation.core.Simulation;
import fr.sncf.osrd.util.simulation.core.SimulationError;

/**
 * Regular event sources don't keep a reference to the events they send, which makes it hard to cancel events.
 * A cancellable event source works one event at a time: it plans one event ahead at the beginning of the simulation,
 * and plans new events as they happen.
 *
 * @param <T> the type of the event's value
 * @param <BaseT> the base type for all values
 */
public class CancellableEventSource<T extends BaseT, WorldT, BaseT> extends EventSource<T, WorldT, BaseT> {
    private final EventProducer<T, WorldT, BaseT> eventProducer;

    private AbstractEvent<T, WorldT, BaseT> currentEvent = null;

    public AbstractEvent<T, WorldT, BaseT> getCurrentEvent() {
        return currentEvent;
    }

    /**
     * Creates an event source that makes it easier to cancel events
     * @param eventProducer a function that produces the events
     */
    public CancellableEventSource(EventProducer<T, WorldT, BaseT> eventProducer) {
        this.eventProducer = eventProducer;
        subscribe(this::reactToUpdate);
    }

    private void nextEvent(Simulation<WorldT, BaseT> sim) throws SimulationError {
        currentEvent = eventProducer.nextEvent(sim);
    }

    /**
     * Creates the initial event of this source.
     * Must be called before the simulation starts.
     * @param sim the simulation
     * @throws SimulationError {@inheritDoc}
     */
    public void init(Simulation<WorldT, BaseT> sim) throws SimulationError {
        assert currentEvent == null;
        nextEvent(sim);
    }

    private void reactToUpdate(
            Simulation<WorldT, BaseT> sim,
            Event<T, WorldT, BaseT> event,
            AbstractEvent.EventState state
    ) throws SimulationError {
        assert currentEvent.getState().isFinalState();
        nextEvent(sim);
    }
}
