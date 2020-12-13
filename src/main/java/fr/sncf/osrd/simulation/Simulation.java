package fr.sncf.osrd.simulation;

import static fr.sncf.osrd.simulation.AbstractEvent.EventState;
import static fr.sncf.osrd.simulation.AbstractProcess.ProcessState;

import fr.sncf.osrd.App;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

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
public class Simulation<BaseT> {
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
    private final SortedSet<AbstractEvent<? extends BaseT, BaseT>> scheduledEvents = new TreeSet<>();

    // the list of all processes that are ready to execute
    private final ArrayDeque<Process<BaseT>> pendingProcesses = new ArrayDeque<>();

    private void executePendingProcesses(AbstractEvent<? extends BaseT, BaseT> event) throws SimulationError {
        while (!pendingProcesses.isEmpty()) {
            var process = pendingProcesses.removeFirst();

            if (process.state != ProcessState.EXECUTION_PENDING)
                throw new SimulationError("A process in the pending queue has an invalid state");

            process.state = ProcessState.EXECUTING;
            do
                process.state = process.react(this, event);
            while (process.state == ProcessState.EXECUTING);

            if (process.state == ProcessState.EXECUTION_PENDING)
                pendingProcesses.addLast(process);
        }
    }

    private long nextRevision() {
        var res = revision;
        revision++;
        return res;
    }

    /**
     * registers an event for scheduling.
     * @param event the event to schedule on the timeline
     * @throws SimulationError If a logic error occurs
     */
    public <T extends BaseT> void registerEvent(AbstractEvent<T, BaseT> event) throws SimulationError {
        if (event.state != EventState.UNINITIALIZED)
            throw new SimulationError("only uninitialized events can be scheduled");

        scheduledEvents.add(event);
        event.state = EventState.SCHEDULED;
    }

    public <T extends BaseT> void event(EventSource<T, BaseT> source, double scheduledTime, T value) throws SimulationError {
        var event = new Event<>(scheduledTime, nextRevision(), value, source);
        registerEvent(event);
    }

    /**
     * Remove a planned event from the timeline.
     * Processes waiting on the event are notified, and the event can't be used anymore.
     * @param event the event to cancel
     * @throws SimulationError when the event isn't scheduled
     */
    public void cancel(Event<? extends BaseT, BaseT> event) throws SimulationError {
        if (event.state != EventState.SCHEDULED)
            throw new SimulationError("only scheduled events can be cancelled");
        scheduledEvents.remove(event);
        signalEventStateChange(EventState.CANCELLED, event);
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
    public Process<BaseT> registerProcess(Process<BaseT> process) throws SimulationError {
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
    private void signalEventStateChange(EventState newEventState, AbstractEvent<? extends BaseT, BaseT> event) throws SimulationError {
        event.state = newEventState;

        // send a signal to all the processes waiting for the event, and clear the waiting list
        for (var process : event.getDependantProcesses()) {
            assert process.state == ProcessState.WAITING;

            // tell the process one of its dependencies has changed state
            var processDecision = process.eventStateChange(event, newEventState);

            // if the process asked to get scheduled, add it to the wait list
            switch (processDecision) {
                case KEEP_WAITING:
                    break;
                case SCHEDULE_PROCESS:
                    pendingProcesses.addLast(process);
                    assert process.state == ProcessState.WAITING;
                    process.state = ProcessState.EXECUTION_PENDING;
                    break;
            }
        }

        // if some processes were woken up by the event, execute these
        executePendingProcesses(event);
    }

    /**
     * Runs the simulation until nothing moves
     * @throws SimulationError when something isn't quite right about the simulation logic
     */
    public BaseT step() throws SimulationError {
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
        assert event.state == EventState.SCHEDULED;
        signalEventStateChange(EventState.HAPPENING, event);

        event.state = EventState.HAPPENED;
        return eventValue;
    }
}
