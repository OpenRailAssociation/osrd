package fr.sncf.osrd.simulation;

import java.util.ArrayList;
import java.util.List;

public abstract class AbstractEntity<T extends AbstractEntity<T>> implements Entity<T> {
    /** A list of entities which should be notified abouts events from this entity */
    public final transient ArrayList<Entity<?>> subscribers = new ArrayList<>();

    /** A unique identifier for this entity */
    public final EntityID<T> id;

    protected AbstractEntity(EntityID<T> id) {
        this.id = id;
    }

    @Override
    public EntityID<T> getID() {
        return id;
    }

    @Override
    public List<Entity<?>> getSubscribers() {
        return subscribers;
    }

    // region STD_OVERRIDES

    @Override
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (this.getClass() != obj.getClass())
            return false;

        var other = (AbstractEntity<?>) obj;

        if (!this.id.equals(other.id))
            return false;

        // equal entities have the same number of subscribers
        if (this.subscribers.size() != other.subscribers.size())
            return false;

        // compare the IDs of the list of subscribers
        for (int i = 0; i < subscribers.size(); i++) {
            var ourSub = subscribers.get(i);
            var theirSub = other.subscribers.get(i);

            if (!ourSub.getID().equals(theirSub.getID()))
                return false;
        }

        return true;
    }

    @Override
    public int hashCode() {
        return id.hashCode();
    }

    // endregion
}
