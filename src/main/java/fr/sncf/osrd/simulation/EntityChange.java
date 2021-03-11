package fr.sncf.osrd.simulation;

public abstract class EntityChange<
        EntityT extends Entity<EntityT>,
        EntityIDT extends EntityID<EntityT>, ResultT
        > extends Change {
    public final EntityIDT entityId;

    protected EntityChange(Simulation sim, EntityIDT entityId) {
        super(sim);
        this.entityId = entityId;
    }

    public abstract ResultT apply(Simulation sim, EntityT entity);

    @Override
    public void replay(Simulation sim) {
        this.apply(sim, entityId.getEntity(sim));
    }
}
