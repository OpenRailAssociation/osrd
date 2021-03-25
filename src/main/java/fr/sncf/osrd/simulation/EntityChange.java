package fr.sncf.osrd.simulation;

public abstract class EntityChange<EntityT, ResultT> extends Change {
    protected EntityChange(Simulation sim) {
        super(sim);
    }

    public abstract ResultT apply(Simulation sim, EntityT entity);

    public abstract EntityT getEntity(Simulation sim);

    @Override
    public void replay(Simulation sim) {
        this.apply(sim, getEntity(sim));
    }
}
