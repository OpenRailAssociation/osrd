package fr.sncf.osrd.simulation;

import static fr.sncf.osrd.simulation.TimelineEvent.State;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.timetable.Schedule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

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
public final class Simulation {
    static final Logger logger = LoggerFactory.getLogger(Simulation.class);

    /** A map from entity identifiers to entities. */
    private final HashMap<String, Entity> entities = new HashMap<>();

    public final World world;

    // changes may need to be logged to enable replays
    // it's basically a pointer to the event sourcing
    // event store insertion function
    public final ChangeLog changelog;

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
    private final SortedMap<TimelineEventId, TimelineEvent<?>> timeline = new TreeMap<>();

    /** The number of event that were scheduled. it is used to associate a unique number to events. */
    long revision = 0;

    /**
     * Creates a new Discrete TimelineEvent SimulationManager
     * @param world the external state of the simulation
     * @param time the initial time of the simulation
     */
    public Simulation(
            World world,
            double time,
            ChangeLog changelog
    ) {
        this.changelog = changelog;
        this.world = world;
        this.startTime = time;
        this.time = time;
    }

    /**
     * Creates a simulation, including the required entities to make it work.
     * @param infra the infrastructure to work on
     * @param simStartTime the start time of the simulation
     * @param schedule the schedule according to which trains should be started
     * @param changelog where to log changes
     * @return A new simulation
     * @throws SimulationError {@inheritDoc}
     */
    public static Simulation create(
            Infra infra,
            double simStartTime,
            Schedule schedule,
            ChangeLog changelog
    ) throws SimulationError {
        var world = new World(infra);
        var sim = new Simulation(world, simStartTime, changelog);
        world.scheduler = SchedulerSystem.fromSchedule(sim, schedule);
        return sim;
    }

    // region ENTITES

    // TODO: document
    public Entity getEntity(String entityId) {
        return entities.get(entityId);
    }

    public void registerEntity(Entity entity) {
        entities.put(entity.entityId, entity);
    }

    public void removeEntity(Entity entity) {
        entities.remove(entity.entityId);
    }

    // endregion

    // region EVENT_SOURCING

    void onChangeCreated(Change change) {
        if (changelog != null)
            changelog.changeCreationCallback(change);
        change.state = Change.State.REGISTERED;
    }

    /**
     * Sends a change to the event store.
     * @param change the change to publish
     */
    public void publishChange(Change change) {
        logger.info("change published {}", change);
        if (changelog != null)
            changelog.changePublishedCallback(change);
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
    public void cancel(TimelineEvent<?> event) throws SimulationError {
        if (event.state != State.SCHEDULED)
            throw new SimulationError("only scheduled events can be cancelled");

        // remove the event from the timeline
        var change = new TimelineEventCancelled(this, event);
        change.apply(this);
        this.publishChange(change);

        // send update messages to subscribed entities
        event.updateState(this, State.CANCELLED);
    }

    /** Checks if the simulation is over (nextEvent() would throw an exception). */
    public boolean isSimulationOver() {
        return timeline.isEmpty();
    }

    /**
     * Returns the next event from the timeline.
     * @return the next event in the timeline
     */
    public TimelineEvent<?> getNextEvent() {
        // get the next event in the timeline
        return timeline.get(timeline.firstKey());
    }

    /**
     * Executes the next event in the simulation.
     * @throws SimulationError {@inheritDoc}
     */
    public Object step(TimelineEvent<?> event) throws SimulationError {
        // step the simulation time forward
        logger.debug("changing the simulation clock from {} to {}", time, event.scheduledTime);

        var change = new TimelineEventOccurred(this, event);
        change.apply(this);
        this.publishChange(change);

        event.updateState(this, State.HAPPENED);
        return event.value;
    }

    public Object step() throws SimulationError {
        var event = getNextEvent();
        return step(event);
    }

    /**
     * Create a new event
     * @param entity the source of the event
     * @param scheduledTime the time at which the event will occur
     * @param value the value associated with the event. you can get it back when the event happens
     * @param <T> the type of the value
     * @return a timeline event
     * @throws SimulationError {@inheritDoc}
     */
    public <T extends TimelineEventValue> TimelineEvent<T> createEvent(
            Entity entity,
            double scheduledTime,
            T value
    ) throws SimulationError {
        // sanity checks
        if (scheduledTime < time)
            throw new SimulationError("an event was scheduled before the current simulation time");

        // create the event
        var change = new TimelineEventCreated<>(this, entity, this.revision, scheduledTime, value);
        var event = change.apply(this, entity);
        this.publishChange(change);

        // notify listening entities
        event.updateState(this, State.SCHEDULED);
        return event;
    }

    public TimelineEvent<?> getTimelineEvent(TimelineEventId timelineEventId) {
        return timeline.get(timelineEventId);
    }

    // endregion

    // region CHANGES

    public static final class TimelineEventCreated<T extends TimelineEventValue>
            extends EntityChange<Entity, TimelineEvent<T>> {
        private final long revision;
        private final double scheduledTime;
        // this should really be T, but isn't as we need moshi (our serialization framework)
        // to understand this need to be treated as a polymorphic field
        private final TimelineEventValue value;

        TimelineEventCreated(Simulation sim, Entity producer, long revision, double scheduledTime, T value) {
            super(sim, producer);
            this.revision = revision;
            this.scheduledTime = scheduledTime;
            this.value = value;
        }

        @Override
        public final TimelineEvent<T> apply(Simulation sim, Entity entity) {
            // this cast is there to restore the static type parameter, because of the hack above
            @SuppressWarnings("unchecked")
            var event = new TimelineEvent<T>(entity, this.revision, this.scheduledTime, (T) this.value);

            // ensure the simulation has the correct revision number
            assert this.revision == sim.revision;

            // update the revision number of the simulation
            sim.revision = this.revision + 1;

            // add the event to the timeline
            sim.timeline.put(event, event);

            return event;
        }

        @Override
        public final String toString() {
            return String.format(
                    "TimelineEventCreated { revision=%d, scheduledTime=%f, value=%s }",
                    revision,
                    scheduledTime,
                    value.toString()
            );
        }
    }

    public static final class TimelineEventOccurred extends SimChange<Void> {
        public final TimelineEventId timelineEventId;

        /**
         * Creates a change corresponding to a timeline event happening
         * @param sim the simulation
         * @param timelineEventId the identifier of the timeline event
         */
        public TimelineEventOccurred(Simulation sim, TimelineEventId timelineEventId) {
            super(sim);
            // create a copy to avoid getting a superclass
            this.timelineEventId = new TimelineEventId(timelineEventId);
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

        /**
         * Creates a change corresponding to a timeline event being cancelled
         * @param sim the simulation
         * @param timelineEventId the identifier of the timeline event
         */
        public TimelineEventCancelled(Simulation sim, TimelineEventId timelineEventId) {
            super(sim);

            // create a copy to avoid getting a superclass
            this.timelineEventId = new TimelineEventId(timelineEventId);
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

    // region STD_OVERRIDES

    @Override
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (obj.getClass() != Simulation.class)
            return false;

        var otherSim = (Simulation) obj;

        // two simulations must have the same time to be equal
        if (this.time != otherSim.time)
            return false;

        // two simulations must have the same revision to be equal
        if (this.revision != otherSim.revision)
            return false;

        // if the two simulations don't have the same entities, something is off
        if (!this.entities.equals(otherSim.entities))
            return false;

        if (this.timeline.size() != otherSim.timeline.size())
            return false;

        for (var event : this.timeline.values()) {
            var otherEvent = otherSim.timeline.getOrDefault(event, null);

            // stop if some event is in this simulation but not in the other
            if (otherEvent == null)
                return false;

            // stop if the TimelineEventId aren't the same
            if (!event.equals(otherEvent))
                return false;

            // the value and entityId aren't in the equals implementation of events
            // (so events can be both keys and values in the timeline)
            if (!event.value.equals(otherEvent.value))
                return false;
            if (!event.source.entityId.equals(otherEvent.source.entityId))
                return false;
        }

        // if all fields are equal, the simulations are equal
        return true;
    }

    @Override
    public int hashCode() {
        return Objects.hash(time, revision, entities, timeline);
    }

    // endregion
}
