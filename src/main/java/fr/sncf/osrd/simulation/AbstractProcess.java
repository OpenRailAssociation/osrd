package fr.sncf.osrd.simulation;

public abstract class AbstractProcess<EventValueT> {
    protected AbstractProcess() {
        this.state = State.UNINITIALIZED;
    }

    public enum State {
        UNINITIALIZED,
        WAITING,
        EXECUTION_PENDING,
        EXECUTING,
        TERMINATED,
    }

    State state;

    /**
     * Encodes the scheduling decision a process takes when an event it's waiting on happens.
     */
    public enum ProcessSignalDecision {
        SCHEDULE_PROCESS,
        KEEP_WAITING,
    }

    protected abstract ProcessSignalDecision eventStateChange(
            Event<EventValueT> event,
            Event.State newEventState
    ) throws SimulationError;

    public abstract State init(Simulation<EventValueT> sim) throws SimulationError;

    public abstract State react(Simulation<EventValueT> sim) throws SimulationError;

    protected abstract void cancel() throws SimulationError;
}
