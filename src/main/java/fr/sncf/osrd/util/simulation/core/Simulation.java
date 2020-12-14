package fr.sncf.osrd.util.simulation.core;

import static fr.sncf.osrd.util.simulation.core.AbstractEvent.EventState;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

/**
 * <h1>A Discrete Event SimulationManager.</h1>
 *
 * <h2>Life cycle of an event</h2>
 * <ol>
 *   <li>starts out as UNREGISTERED</li>
 *   <li>switches to SCHEDULED when it's registered with the simulation</li>
 *   <li>the event may be CANCELED at this point</li>
 *   <li>once its time comes, it switches to HAPPENED</li>
 * </ol>
 *
 * <p>State changes are the responsibility of the event. When an event changes state, it will probably
 * notify some listeners.</p>
 *
 * <h2>Life cycle of a simulation</h2>
 * <ol>
 *   <li>If there are no more SCHEDULED events, the simulation is over</li>
 *   <li>execute the next event in the schedule, moving the simulation time forward to the time of the event</li>
 *   <li>loop</li>
 * </ol>
 */
public class Simulation<WorldT, BaseT> {
    static final Logger logger = LoggerFactory.getLogger(Simulation.class);

    public final WorldT world;

    /**
     * Creates a new Discrete Event SimulationManager
     * @param world the external state of the simulation
     * @param time the initial time of the simulation
     */
    public Simulation(WorldT world, double time) {
        this.world = world;
        this.time = time;
    }

    // the current time of the simulation.
    // when an event is executed, the simulation time is changed to the event's time
    private double time;

    public double getTime() {
        return time;
    }

    // the list of events pending execution
    private final SortedSet<AbstractEvent<? extends BaseT, WorldT, BaseT>> scheduledEvents = new TreeSet<>();

    // the number of event that were scheduled. it is used to associate a unique number to events
    long revision = 0;

    long nextRevision() {
        var res = revision;
        revision++;
        return res;
    }

    /**
     * Registers an event for scheduling.
     * @param event the event to schedule on the timeline
     * @throws SimulationError {@inheritDoc}
     */
    public <T extends BaseT> void registerEvent(AbstractEvent<T, WorldT, BaseT> event) throws SimulationError {
        if (event.state != EventState.UNREGISTERED)
            throw new SimulationError("only uninitialized events can be scheduled");

        if (event.scheduledTime < time)
            throw new SimulationError("an event was scheduled before the current simulation time");

        event.updateState(this, EventState.SCHEDULED);
        scheduledEvents.add(event);
    }


    /**
     * Remove a planned event from the timeline.
     * Once cancelled, the event can't be used anymore.
     * @param event the event to cancel
     * @throws SimulationError {@inheritDoc}
     */
    public void cancel(AbstractEvent<? extends BaseT, WorldT, BaseT> event) throws SimulationError {
        if (event.state != EventState.SCHEDULED)
            throw new SimulationError("only scheduled events can be cancelled");
        scheduledEvents.remove(event);
        event.updateState(this, EventState.CANCELLED);
    }

    public boolean isSimulationOver() {
        return scheduledEvents.isEmpty();
    }

    /**
     * Executes the next event in the simulation.
     * @throws SimulationError {@inheritDoc}
     */
    public BaseT step() throws SimulationError {
        // get the next event in the timeline
        var event = scheduledEvents.first();
        scheduledEvents.remove(event);

        // step the simulation time forward
        logger.debug("stepping the simulation from {} to {}", time, event.scheduledTime);
        assert event.scheduledTime >= time;
        time = event.scheduledTime;

        event.updateState(this, EventState.HAPPENED);
        return event.value;
    }
}
