package fr.sncf.osrd.simulation;

import java.util.Objects;

public class EntityID {
    public final EntityType type;
    public final String id;

    public EntityID(EntityType type, String id) {
        this.type = type;
        this.id = id;
    }

    @Override
    public int hashCode() {
        return Objects.hash(type, id);
    }

    public boolean equalIDs(EntityID other) {
        return id.equals(other.id) && type == other.type;
    }

    @Override
    public boolean equals(Object obj) {
        if (!(obj instanceof EntityID))
            return false;

        return equalIDs((EntityID) obj);
    }
}
