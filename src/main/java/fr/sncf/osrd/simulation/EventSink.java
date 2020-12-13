package fr.sncf.osrd.simulation;

import fr.sncf.osrd.simulation.core.AbstractEvent;
import fr.sncf.osrd.simulation.core.Simulation;
import fr.sncf.osrd.simulation.core.SimulationError;

@FunctionalInterface
public interface EventSink<T extends BaseT, BaseT> {
    void feed(Simulation<BaseT> sim, Event<T, BaseT> event, AbstractEvent.EventState state) throws SimulationError;
}
