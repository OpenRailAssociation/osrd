package fr.sncf.osrd.util.simulation;

import fr.sncf.osrd.util.simulation.core.AbstractEvent;
import fr.sncf.osrd.util.simulation.core.Simulation;
import fr.sncf.osrd.util.simulation.core.SimulationError;

@FunctionalInterface
public interface EventProducer<T extends BaseT, WorldT, BaseT> {
    public abstract AbstractEvent<T, WorldT, BaseT> nextEvent(Simulation<WorldT, BaseT> sim) throws SimulationError;
}
