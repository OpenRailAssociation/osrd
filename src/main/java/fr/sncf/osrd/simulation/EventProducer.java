package fr.sncf.osrd.simulation;

import fr.sncf.osrd.simulation.core.AbstractEvent;
import fr.sncf.osrd.simulation.core.Simulation;
import fr.sncf.osrd.simulation.core.SimulationError;

@FunctionalInterface
public interface EventProducer<T extends BaseT, BaseT> {
    public abstract AbstractEvent<T, BaseT> nextEvent(Simulation<BaseT> sim) throws SimulationError;
}
