package fr.sncf.osrd.simulation;

import fr.sncf.osrd.simulation.core.AbstractEvent;
import fr.sncf.osrd.simulation.core.Simulation;
import fr.sncf.osrd.simulation.core.SimulationError;

/**
 * Regular event sources don't keep a reference to the events they send, which makes it hard to cancel events.
 * A cancellable event source works one event at a time: it plans one event ahead at the beginning of the simulation,
 * and plans new events as they happen.
 *
 * @param <T> the type of the event's value
 * @param <BaseT> the base type for all values
 */
public class CancellableEventSource<T extends BaseT, BaseT> extends EventSource<T, BaseT> {
    private final EventProducer<T, BaseT> eventProducer;

    private AbstractEvent<T, BaseT> currentEvent = null;

    public AbstractEvent<T, BaseT> getCurrentEvent() {
        return currentEvent;
    }

    /**
     * Creates an event source that makes it easier to cancel events
     * @param eventProducer a function that produces the events
     */
    public CancellableEventSource(EventProducer<T, BaseT> eventProducer) {
        this.eventProducer = eventProducer;
        subscribe(this::reactToUpdate);
    }

    private void nextEvent(Simulation<BaseT> sim) throws SimulationError {
        currentEvent = eventProducer.nextEvent(sim);
    }

    /**
     * Creates the initial event of this source.
     * Must be called before the simulation starts.
     * @param sim the simulation
     * @throws SimulationError {@inheritDoc}
     */
    public void init(Simulation<BaseT> sim) throws SimulationError {
        assert currentEvent == null;
        nextEvent(sim);
    }

    private void reactToUpdate(
            Simulation<BaseT> sim,
            Event<T, BaseT> event,
            AbstractEvent.EventState state
    ) throws SimulationError {
        assert currentEvent.getState().isFinalState();
        nextEvent(sim);
    }
}
