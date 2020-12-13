package fr.sncf.osrd.simulation;

public final class Event<T extends BaseT, BaseT> extends AbstractEvent<T, BaseT> {
    final EventSource<T, BaseT> source;


    Event(double scheduledTime, long revision, T value, EventSource<T, BaseT> source) {
        super(scheduledTime, revision, value);
        this.source = source;
    }

    @Override
    public void updateState(Simulation<BaseT> sim, EventState state) throws SimulationError {
        this.state = state;
        for (var sink : source.subscribers) {
            sink.feed(sim, this, state);
        }
    }
}
