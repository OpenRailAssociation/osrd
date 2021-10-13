package fr.sncf.osrd.simulation;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.SuccessionTable;
import fr.sncf.osrd.infra_state.InfraState;
import fr.sncf.osrd.simulation.changelog.ChangeConsumer;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.utils.DeepComparable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.HashMap;
import java.util.List;
import java.util.SortedMap;
import java.util.TreeMap;

/**
 * <h1>A Discrete TimelineEvent Simulation.</h1>
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
public final class Simulation implements DeepComparable<Simulation> {
    static final Logger logger = LoggerFactory.getLogger(Simulation.class);

    public final Infra infra;
    public final InfraState infraState;
    public final HashMap<String, Train> trains = new HashMap<>();

    // changes may need to be logged to enable replays
    // it's basically a pointer to the event sourcing
    // event store insertion function
    public final ChangeConsumer changeConsumer;

    /**
     * The current time of the simulation.
     * when an event is executed, the simulation time is changed to the event's time.
     */
    private double time;

    public double getTime() {
        return time;
    }

    /** The time at which the simulation started. */
    public final double startTime;

    /** The list of events pending execution. */
    private final SortedMap<TimelineEventId, TimelineEvent> timeline = new TreeMap<>();

    /** The number of event that were scheduled. it is used to associate a unique number to events. */
    private long revision = 0;

    /** Creates a new Discrete TimelineEvent SimulationManager */
    private Simulation(
            Infra infra,
            InfraState infraState,
            double time,
            ChangeConsumer changeConsumer
    ) {
        this.infra = infra;
        this.infraState = infraState;
        this.startTime = time;
        this.time = time;
        this.changeConsumer = changeConsumer;
    }

    /** Creates a simulation and initialize infrastructure entities */
    public static Simulation createFromInfraAndEmptySuccessions(
            Infra infra,
            double simStartTime,
            ChangeConsumer changeConsumer
    ) {
        var infraState = InfraState.from(infra);
        return new Simulation(infra, infraState, simStartTime, changeConsumer);
    }
    
    /** Creates a simulation and initialize infrastructure entities */
    public static Simulation createFromInfraAndSuccessions(
            Infra infra,
            List<SuccessionTable> initTables,
            double simStartTime,
            ChangeConsumer changeConsumer
    ) {
        var infraState = InfraState.from(infra, initTables);
        return new Simulation(infra, infraState, simStartTime, changeConsumer);
    }

    /** Creates a simulation without any infra linked (for testing) */
    public static Simulation createWithoutInfra(
            double simStartTime,
            ChangeConsumer changeConsumer
    ) {
        return new Simulation(null, null, simStartTime, changeConsumer);
    }


    // region EVENT_SOURCING

    void onChangeCreated(Change change) {
        if (changeConsumer != null)
            changeConsumer.changeCreationCallback(change);
        change.state = Change.State.REGISTERED;
    }

    /**
     * Sends a change to the event store.
     * @param change the change to publish
     */
    public void publishChange(Change change) {
        logger.info("change published {}", change);
        if (changeConsumer != null)
            changeConsumer.changePublishedCallback(change);
        change.state = Change.State.PUBLISHED;
    }

    // endregion

    // region DISCRETE_EVENT_SIMULATION

    /**
     * Remove a planned event from the timeline.
     * Once cancelled, the event can't be used anymore.
     * @param event the event to cancel
     * @throws SimulationError {@inheritDoc}
     */
    public void cancel(TimelineEvent event) throws SimulationError {
        // remove the event from the timeline
        var change = new TimelineEventCancelled(this, event.eventId);
        change.apply(this);
        this.publishChange(change);

        // send update messages to subscribed entities
        event.setState(TimelineEvent.State.CANCELLED);
        event.onCancellation(this);
    }

    /** Checks if the simulation is over (nextEvent() would throw an exception). */
    public boolean isSimulationOver() {
        return timeline.isEmpty();
    }

    public TimelineEvent peekNextEvent() {
        return timeline.get(timeline.firstKey());
    }

    /**
     * Executes the next event in the simulation.
     * @throws SimulationError {@inheritDoc}
     */
    public TimelineEvent step() throws SimulationError {
        var event = peekNextEvent();

        // step the simulation time forward
        logger.debug("changing the simulation clock from {} to {}", time, event.eventId.scheduledTime);

        var change = new TimelineEventOccurred(this, event.eventId);
        change.apply(this);
        this.publishChange(change);

        event.setState(TimelineEvent.State.OCCURRED);
        event.onOccurrence(this);
        return event;
    }

    // endregion

    // region CHANGES

    public abstract static class TimelineEventCreated extends Change {
        public final TimelineEventId eventId;

        protected TimelineEventCreated(Simulation sim, double scheduledTime) {
            super(sim);
            this.eventId = new TimelineEventId(scheduledTime, sim.revision);
        }

        protected void scheduleEvent(Simulation sim, TimelineEvent event) {
            assert event.eventId == this.eventId;
            var eventId = event.eventId;
            assert eventId.scheduledTime >= sim.time;

            // increment the revision of the simulation
            // a mismatch here can be caused by:
            //  - not scheduling a TimelineEventCreated immediately after creation
            //  - replaying changes after missing some
            assert sim.revision == eventId.revision : "event revision mismatch";
            sim.revision++;

            // add the event to the timeline
            sim.timeline.put(eventId, event);

            event.setState(TimelineEvent.State.SCHEDULED);
        }
    }

    public static final class TimelineEventOccurred extends SimChange<Void> {
        public final TimelineEventId timelineEventId;

        TimelineEventOccurred(Simulation sim, TimelineEventId timelineEventId) {
            super(sim);
            this.timelineEventId = timelineEventId;
        }

        @Override
        public final Void apply(Simulation sim) {
            // remove the event from the timeline
            sim.timeline.remove(timelineEventId);

            var scheduledTime = timelineEventId.scheduledTime;

            // the event shouldn't move the simulation time backwards
            assert scheduledTime >= sim.time;

            // move the simulation time forward
            sim.time = scheduledTime;
            return null;
        }

        @Override
        public final String toString() {
            return String.format("TimelineEventOccurred { %s }", timelineEventId.toString());
        }
    }

    public static final class TimelineEventCancelled extends SimChange<Void> {
        public final TimelineEventId timelineEventId;

        TimelineEventCancelled(Simulation sim, TimelineEventId timelineEventId) {
            super(sim);
            this.timelineEventId = timelineEventId;
        }

        @Override
        public final Void apply(Simulation sim) {
            // remove the event from the timeline, as it was cancelled.
            sim.timeline.remove(timelineEventId);
            return null;
        }

        @Override
        public final String toString() {
            return String.format("TimelineEventCancelled { %s }", timelineEventId.toString());
        }
    }

    // endregion

    @Override
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public boolean deepEquals(Simulation otherSim) {
        // two simulations must have the same time to be equal
        if (this.time != otherSim.time)
            return false;

        // two simulations must have the same revision to be equal
        if (this.revision != otherSim.revision)
            return false;

        if (this.timeline.size() != otherSim.timeline.size())
            return false;

        for (var event : this.timeline.values()) {
            var otherEvent = otherSim.timeline.getOrDefault(event.eventId, null);

            // stop if some event is in this simulation but not in the other
            if (otherEvent == null)
                return false;

            // stop if the TimelineEventId aren't the same
            if (!event.deepEquals(otherEvent))
                return false;
        }

        // this slightly weird edge case is only used for testing
        if (this.infraState == null && otherSim.infraState == null)
            return true;
        if (this.infraState == null || otherSim.infraState == null)
            return false;

        return this.infraState.deepEquals(otherSim.infraState);
    }
}
