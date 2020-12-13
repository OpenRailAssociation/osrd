package fr.sncf.osrd.simulation;

public abstract class AbstractProcess<BaseT> {
    protected AbstractProcess() {
        this.state = ProcessState.UNINITIALIZED;
    }

    public enum ProcessState {
        UNINITIALIZED,
        WAITING,
        EXECUTION_PENDING,
        EXECUTING,
        TERMINATED,
    }

    ProcessState state;

    /**
     * Encodes the scheduling decision a process takes when an event it's waiting on happens.
     */
    public enum ProcessSchedulingDecision {
        SCHEDULE_PROCESS,
        KEEP_WAITING,
    }

    public abstract ProcessSchedulingDecision eventStateChange(
            AbstractEvent<? extends BaseT, BaseT> event,
            AbstractEvent.EventState newEventState
    ) throws SimulationError;

    public abstract ProcessState init(Simulation<BaseT> sim) throws SimulationError;

    public abstract ProcessState react(Simulation<BaseT> sim, AbstractEvent<?, BaseT> event) throws SimulationError;

    protected abstract void cancel() throws SimulationError;
}
