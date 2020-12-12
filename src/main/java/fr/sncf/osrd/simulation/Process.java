package fr.sncf.osrd.simulation;

import static fr.sncf.osrd.simulation.AbstractProcess.ProcessSignalDecision.*;
import static fr.sncf.osrd.simulation.Process.WaitOption.*;

import java.util.ArrayList;

public abstract class Process<EventValueT> extends AbstractProcess<EventValueT> {
    protected final ArrayList<Event<EventValueT>> triggeredEvents = new ArrayList<>();
    protected final ArrayList<Event<EventValueT>> pendingEvents = new ArrayList<>();
    protected Event<EventValueT> cancelledEvent = null;

    protected enum WaitMode {
        WAIT_ANY,
        WAIT_ALL,
    }

    protected WaitMode waitMode;

    private ProcessSignalDecision eventHappened(Event<EventValueT> event) throws SimulationError {
        // update the triggered / pending sets
        triggeredEvents.add(event);
        if (!pendingEvents.remove(event))
            throw new SimulationError("a process was notified of the completion of an event it wasn't waiting on");

        switch (waitMode) {
            case WAIT_ALL:
                if (pendingEvents.isEmpty())
                    return SCHEDULE_PROCESS;
                return KEEP_WAITING;
            case WAIT_ANY:
                return SCHEDULE_PROCESS;
            default:
                throw new SimulationError("invalid process WaitMode");
        }
    }

    private ProcessSignalDecision eventCancelled(Event<EventValueT> event) throws SimulationError {
        return null;
    }

    @Override
    protected ProcessSignalDecision eventStateChange(
            Event<EventValueT> event,
            Event.State newEventState
    ) throws SimulationError {
        assert this.state == State.WAITING;

        switch (newEventState) {
            case HAPPENING:
                return eventHappened(event);
            case CANCELLED:
                return eventCancelled(event);
            default:
                throw new SimulationError("process got notified of an invalid event state change");
        }
    }

    public enum WaitOption {
        /**  Move all triggered events to the pending set. */
        REARM_TRIGGERED(1),
        /**  Removes everything from the pending set before anything else */
        CLEAR_PENDING(1 << 1),
        ;

        public final int value;

        WaitOption(int value) {
            this.value = value;
        }
    }

    protected State terminate() throws SimulationError {
        return State.TERMINATED;
    }

    protected State terminate(
            Simulation<EventValueT> sim,
            Event<EventValueT> event,
            EventValueT value
    ) throws SimulationError {
        sim.scheduleNow(event, value);
        return State.TERMINATED;
    }

    protected State waitEvents(Event<EventValueT> event) {
        return waitEvents(WaitMode.WAIT_ALL, 0, event);
    }

    @SafeVarargs
    protected final State waitEvents(WaitMode mode, Event<EventValueT>... events) {
        return waitEvents(mode, 0, events);
    }

    @SafeVarargs
    protected final State waitEvents(WaitMode mode, WaitOption option, Event<EventValueT>... events) {
        return waitEvents(mode, option.value, events);
    }

    @SafeVarargs
    protected final State waitEvents(WaitMode mode, int options, Event<EventValueT>... events) {
        // process options
        if ((options & CLEAR_PENDING.value) != 0)
            pendingEvents.clear();

        if ((options & REARM_TRIGGERED.value) != 0) {
            for (var event : triggeredEvents)
                if (event.type != Event.EventType.SINGLE_USE)
                    registerEventWait(event);
        }

        // clear the list of events that triggered
        triggeredEvents.clear();

        // register the explicit wait events
        for (var event : events)
            registerEventWait(event);

        waitMode = mode;
        return State.WAITING;
    }

    private void removePendingEvent(Event<EventValueT> event) {
        pendingEvents.remove(event);
        event.waitingProcesses.remove(this);
    }

    private void registerEventWait(Event<EventValueT> event) {
        assert !pendingEvents.contains(event);
        pendingEvents.add(event);
        assert !event.waitingProcesses.contains(this);
        event.waitingProcesses.add(this);
    }

    @Override
    protected void cancel() throws SimulationError {
        while (!pendingEvents.isEmpty()) {
            var lastPendingEvent = pendingEvents.get(pendingEvents.size() - 1);
            removePendingEvent(lastPendingEvent);
        }
    }
}
