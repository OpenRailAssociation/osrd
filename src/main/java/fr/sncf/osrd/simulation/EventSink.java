package fr.sncf.osrd.simulation;

@FunctionalInterface
public interface EventSink<T extends BaseT, BaseT> {
    void feed(Simulation<BaseT> sim, Event<T, BaseT> event, AbstractEvent.EventState state) throws SimulationError;
}
