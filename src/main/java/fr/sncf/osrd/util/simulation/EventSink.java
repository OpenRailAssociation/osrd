package fr.sncf.osrd.util.simulation;

import fr.sncf.osrd.util.simulation.core.AbstractEvent;
import fr.sncf.osrd.util.simulation.core.Simulation;
import fr.sncf.osrd.util.simulation.core.SimulationError;

@FunctionalInterface
public interface EventSink<T extends BaseT, WorldT, BaseT> {
    void feed(
            Simulation<WorldT, BaseT> sim,
            Event<T, WorldT, BaseT> event,
            AbstractEvent.EventState state
    ) throws SimulationError;
}
