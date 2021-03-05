package fr.sncf.osrd.simulation;

public abstract class EntityChange<EntityT extends Entity<EntityT>, ResultT> extends Change {
    public final EntityID<EntityT> entityId;

    protected EntityChange(Simulation sim, EntityID<EntityT> entityId) {
        super(sim);
        this.entityId = entityId;
    }

    public abstract ResultT apply(Simulation sim, EntityT entity);

    @Override
    public void replay(Simulation sim) {
        this.apply(sim, entityId.getEntity(sim));
    }
}
