package fr.sncf.osrd;

import fr.sncf.osrd.simulation.Simulation;

public final class MockEntityID<T extends Entity<T>> implements EntityID<T> {
    public final String id;

    public MockEntityID(String id) {
        this.id = id;
    }

    @Override
    public T getEntity(Simulation sim) {
        throw new RuntimeException("cannot replay mock entities");
    }

    @Override
    public int hashCode() {
        return id.hashCode();
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == null)
            return false;
        if (obj.getClass() != MockEntityID.class)
            return false;
        return id.equals(((MockEntityID<?>) obj).id);
    }
}
