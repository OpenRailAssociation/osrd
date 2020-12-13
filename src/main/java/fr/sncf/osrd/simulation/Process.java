package fr.sncf.osrd.simulation;


public abstract class Process<BaseT> extends AbstractProcess<BaseT> {
    @Override
    public ProcessSchedulingDecision eventStateChange(
            AbstractEvent<? extends BaseT, BaseT> event,
            AbstractEvent.EventState newEventState
    ) throws SimulationError {
        return ProcessSchedulingDecision.SCHEDULE_PROCESS;
    }

    @Override
    protected void cancel() throws SimulationError {
    }
}
