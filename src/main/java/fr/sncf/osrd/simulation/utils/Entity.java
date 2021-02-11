package fr.sncf.osrd.simulation.utils;

import java.util.ArrayList;
import java.util.Objects;

public abstract class Entity {
    public final String entityId;
    public final transient ArrayList<Entity> subscribers = new ArrayList<>();

    protected Entity(String entityId) {
        this.entityId = entityId;
    }

    // region STD_OVERRIDES

    @Override
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (this.getClass() != obj.getClass())
            return false;

        var other = (Entity) obj;
        if (!this.entityId.equals(other.entityId))
            return false;

        // equal entities have the same number of subscribers
        if (this.subscribers.size() != other.subscribers.size())
            return false;

        // compare the IDs of the list of subscribers
        for (int i = 0; i < subscribers.size(); i++) {
            var ourSub = subscribers.get(i);
            var theirSub = other.subscribers.get(i);

            if (!ourSub.entityId.equals(theirSub.entityId))
                return false;
        }

        return true;
    }

    @Override
    public int hashCode() {
        // we can't just do that, as two mutually subscribed entities wouldn't
        // be able to compute their hash without running into infinite recursion
        // return Objects.hash(entityId, subscribers);

        var hash = entityId.hashCode();
        for (var sub : subscribers)
            hash = Objects.hash(hash, sub.entityId);
        return hash;
    }

    // endregion

    protected abstract void timelineEventUpdate(
            Simulation sim,
            TimelineEvent<?> event,
            TimelineEvent.State state
    ) throws SimulationError;

    public void addSubscriber(Entity sink) {
        assert !subscribers.contains(sink);
        subscribers.add(sink);
    }

    /**
     * Unsubscribes a sink from a source.
     * If this function fails, it's probably because you subscribed a lambda or method reference,
     * and then tried removing a similar yet not equal lambda or method reference.
     * {@code this::myMethod != this::myMethod}
     *
     * @param sink the sink to unsubscribe
     */
    public void removeSubscriber(Entity sink) throws SimulationError {
        assert subscribers.contains(sink);
        if (!subscribers.remove(sink))
            throw new SimulationError(
                    "can't unsubscribe a sink that's not in the subscribers list."
                            + " try storing your lambda or method reference in a field of your class");
    }

    /**
     * Creates a new event.
     * @param sim the simulation this events belongs to
     * @param scheduledTime the simulation time this event should happen at
     * @param value the value associated with the event
     * @return a new event
     * @throws SimulationError {@inheritDoc}
     */
    public <T extends TimelineEventValue> TimelineEvent<T> createEvent(
            Simulation sim,
            double scheduledTime, T value
    ) throws SimulationError {
        return sim.createEvent(this, scheduledTime, value);
    }
}
