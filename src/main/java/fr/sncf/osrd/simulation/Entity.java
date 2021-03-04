package fr.sncf.osrd.simulation;

import java.util.ArrayList;
import java.util.Objects;

public abstract class Entity extends EntityID {
    public final transient ArrayList<Entity> subscribers = new ArrayList<>();

    protected Entity(EntityType type, String id) {
        super(type, id);
    }

    // region STD_OVERRIDES

    @Override
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (this.getClass() != obj.getClass())
            return false;

        var other = (Entity) obj;

        if (!this.equalIDs(other))
            return false;

        // equal entities have the same number of subscribers
        if (this.subscribers.size() != other.subscribers.size())
            return false;

        // compare the IDs of the list of subscribers
        for (int i = 0; i < subscribers.size(); i++) {
            var ourSub = subscribers.get(i);
            var theirSub = other.subscribers.get(i);

            if (!ourSub.equalIDs(theirSub))
                return false;
        }

        return true;
    }

    @Override
    public int hashCode() {
        // we can't just do that, as two mutually subscribed entities wouldn't
        // be able to compute their hash without running into infinite recursion
        // return Objects.hash(type, id, subscribers);

        var hash = Objects.hash(type, id);
        for (var sub : subscribers)
            hash = Objects.hash(hash, sub.type, sub.id);
        return hash;
    }

    // endregion

    protected abstract void onTimelineEventUpdate(
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
}
