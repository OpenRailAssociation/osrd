package fr.sncf.osrd.simulation;

import static fr.sncf.osrd.simulation.Event.State.*;
import static fr.sncf.osrd.simulation.AbstractProcess.State.*;

import fr.sncf.osrd.App;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.util.function.Consumer;

/**
 * <h1>A Discrete Event Simulation.</h1>
 *
 * <p>Life cycle of an event:</p>
 * <ol>
 *   <li>starts out as SCHEDULED or UNPLANNED</li>
 *   <li>if the event is UNPLANNED, nothing happens until it switches to SCHEDULED by
 *       getting a planned execution time</li>
 *   <li>once its time comes, it switches to happening</li>
 *   <li>processes waiting on this event are signaled <b>and</b>
 *      the list of processes waiting for this event is wiped clean</li>
 *   <li>the event can be recycled to PENDING, with a new time and list of waiting processes</li>
 * </ol>
 *
 * <p>Life cycle of a process:</p>
 * <ol>
 *   <li>starts out in either the WAITING or EXECUTION_PENDING state</li>
 *   <li>if the process is WAITING for events to terminate, nothing happens until is switches to
 *       the EXECUTION_PENDING state by getting signaled by all required events</li>
 *   <li>the process is executed, and changes state to either WAITING, EXECUTION_PENDING, or FINISHED</li>
 *   <li>when the process if FINISHED, its completion event is scheduled for the current time</li>
 * </ol>
 *
 * <p>Life cycle of the simulation:</p>
 * <ol>
 *   <li>while there are processes in the EXECUTION_PENDING state, execute those</li>
 *   <li>if there are no more EXECUTION_PENDING processes nor SCHEDULED events, the simulation is over</li>
 *   <li>execute the next event in the schedule, moving the simulation time forward to the time of the event</li>
 *   <li>loop</li>
 * </ol>
 *
 * <b>An event can only be safely waited on once</b>
 */
public class Simulation<EventValueT> {
    static final Logger logger = LoggerFactory.getLogger(App.class);

    public Simulation(double time) {
        this.time = time;
    }

    // the current time of the simulation.
    // when an event is executed, the simulation time is changed to the event's time
    private double time;

    public double getTime() {
        return time;
    }

    // the generation is the number of event that were scheduled
    long revision = 0;

    // the list of events pending execution
    private final SortedSet<Event<EventValueT>> scheduledEvents = new TreeSet<>();

    // the list of all processes that are ready to execute
    private final ArrayDeque<Process<EventValueT>> pendingProcesses = new ArrayDeque<>();

    // a pool of unused events that can be recycled
    private final ArrayDeque<Event<EventValueT>> recycledEvents = new ArrayDeque<>();

    private void executePendingProcesses() throws SimulationError {
        while (!pendingProcesses.isEmpty()) {
            var process = pendingProcesses.removeFirst();

            if (process.state != EXECUTION_PENDING)
                throw new SimulationError("A process in the pending queue has an invalid state");

            process.state = EXECUTING;
            do
                process.state = process.react(this);
            while (process.state == EXECUTING);

            if (process.state == EXECUTION_PENDING)
                pendingProcesses.addLast(process);
        }
    }

    private long nextRevision() {
        var res = revision;
        revision++;
        return res;
    }

    /**
     * Plans an event to be scheduled at a given time, with a given value.
     * @param event the event to schedule on the timeline
     * @param scheduledTime the time to schedule the event at
     * @param value the value associated with the event
     * @throws SimulationError If a logic error occurs
     */
    public void schedule(Event<EventValueT> event, double scheduledTime, EventValueT value) throws SimulationError {
        switch (event.state) {
            case HAPPENED:
            case HAPPENING:
                throw new SimulationError("an event can only be scheduled if it is unplanned");
            case SCHEDULED:
                scheduledEvents.remove(event);
                break;
            case UNPLANNED:
                break;
        }
        event.schedule(scheduledTime, nextRevision());
        scheduledEvents.add(event);
        event.state = SCHEDULED;
        if (value != null)
            event.value = value;

        if (event.value == null)
            throw new SimulationError("scheduled an event without a value");
    }

    public void scheduleNow(Event<EventValueT> event, EventValueT value) throws SimulationError {
        schedule(event, this.time, value);
    }

    public void scheduleTimeout(Event<EventValueT> event, double timeDelta, EventValueT value) throws SimulationError {
        schedule(event, this.time + timeDelta, value);
    }

    /**
     * Creates an event that will happen at the current simulation time + timeDelta
     * @param timeDelta the time to wait for
     * @return the requested timer
     * @throws SimulationError when a logic error occurs
     */
    public Event<EventValueT> timer(double timeDelta, EventValueT value) throws SimulationError {
        var timeoutEvent = newSingleUseEvent();
        scheduleTimeout(timeoutEvent, timeDelta, value);
        return timeoutEvent;
    }

    /**
     * Remove a planned event from the timeline.
     * Processes waiting on the event are notified, and the event can't be used anymore.
     * @param event the event to cancel
     * @throws SimulationError when the event isn't scheduled
     */
    public void cancel(Event<EventValueT> event) throws SimulationError {
        if (event.state != SCHEDULED)
            throw new SimulationError("only scheduled events can be cancelled");
        scheduledEvents.remove(event);
        signalEventStateChange(CANCELLED, event);
        recycle(event);
    }

    /**
     * Creates a new single use event
     * @return a new single use event
     */
    public Event<EventValueT> newSingleUseEvent() {
        if (recycledEvents.isEmpty())
            return new Event<>(Event.EventType.SINGLE_USE, nextRevision());

        return recycledEvents.removeFirst();
    }

    /**
     * Creates a new multi use event
     * @return a new multi use event
     */
    public Event<EventValueT> newMultiUseEvent() {
        return new Event<>(Event.EventType.MULTI_USE, nextRevision());
    }

    public boolean isSimulationOver() {
        return pendingProcesses.isEmpty() && scheduledEvents.isEmpty();
    }

    /**
     * Registers and initializes a process with the simulation.
     * @param process the process to initialize
     * @return the initialized process
     * @throws SimulationError when a logic error occurs
     */
    public Process<EventValueT> registerProcess(Process<EventValueT> process) throws SimulationError {
        // for now, there is no explicit list of all processes in the simulation, simply because it's not needed.
        // however, the API makes it mandatory for processes to register themselves, to allow changing the internals
        // later on.
        process.state = process.init(this);
        return process;
    }

    /**
     * Sends a signal to processes waiting on an event, and clears the list of processes waiting on the event.
     * @param newEventState the new state of the event
     * @param event the event that changed state
     * @throws SimulationError when a logic error occurs
     */
    private void signalEventStateChange(Event.State newEventState, Event<EventValueT> event) throws SimulationError {
        event.state = newEventState;

        // send a signal to all the processes waiting for the event, and clear the waiting list
        for (var process : event.waitingProcesses) {
            assert process.state == WAITING;

            // tell the process one of its dependencies has changed state
            var processDecision = process.eventStateChange(event, newEventState);

            // if the process asked to get scheduled, add it to the wait list
            switch (processDecision) {
                case KEEP_WAITING:
                    break;
                case SCHEDULE_PROCESS:
                    pendingProcesses.addLast(process);
                    assert process.state == WAITING;
                    process.state = EXECUTION_PENDING;
                    break;
            }
        }

        event.waitingProcesses.clear();

        // if some processes were woken up by the event, execute these
        executePendingProcesses();
    }

    private void recycle(Event<EventValueT> event) {
        // single use events can be repurposed after completion,
        // whereas multi use events can trigger again
        switch (event.type) {
            case SINGLE_USE:
                event.recycle();
                recycledEvents.addFirst(event);
                break;
            case MULTI_USE:
                event.state = UNPLANNED;
                break;
        }
    }

    /**
     * Runs the simulation until nothing moves
     * @throws SimulationError when something isn't quite right about the simulation logic
     */
    public EventValueT step() throws SimulationError {
        executePendingProcesses();
        // get the next event in the timeline
        var event = scheduledEvents.first();
        scheduledEvents.remove(event);

        // step the simulation time forward
        if (event.scheduledTime < time)
            throw new SimulationError("an event was scheduled before the current simulation time");
        logger.debug("stepping the simulation from {} to {}", time, event.scheduledTime);
        time = event.scheduledTime;

        final var eventValue = event.value;
        // signal the processes waiting on the event
        assert event.state == SCHEDULED;
        signalEventStateChange(HAPPENING, event);

        event.state = HAPPENED;
        recycle(event);
        return eventValue;
    }
}
