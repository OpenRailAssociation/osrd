package fr.sncf.osrd.simulation.utils;

import java.util.Map;

/**
 * The base interface for all events in the simulation.
 */

public abstract class EntityChange<EntityT extends Entity, ResultT> extends Change {
    public final String entityId;

    protected EntityChange(Simulation sim, EntityT entity) {
        super(sim);
        this.entityId = entity.entityId;
    }

    public abstract ResultT apply(Simulation sim, EntityT entity);

    @Override
    @SuppressWarnings("unchecked")
    public void replay(Simulation sim) {
        // we need this unsafe cast, as there is no formal guarantee that
        // the object with this identifier always has this type:
        // in a simulation run, "foobar" could be a train, and could be a
        // signal in another.
        // This won't happen because we pick our identifiers to be unique
        // to entities, so this cast is fine.
        this.apply(sim, (EntityT) sim.getEntity(entityId));
    }
}
