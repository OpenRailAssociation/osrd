package fr.sncf.osrd.simulation.utils;

@SuppressWarnings("UnusedReturnValue")
public abstract class EntityEventChange<EntityT extends Entity, EventValueT, ResultT> extends Change {
    public final TimelineEventId timelineEventId;
    public final String entityId;

    protected EntityEventChange(Simulation sim, EntityT entity, TimelineEvent<EventValueT> timelineEvent) {
        super(sim);
        this.entityId = entity.entityId;
        this.timelineEventId = new TimelineEventId(timelineEvent);
    }

    @SuppressWarnings("SameReturnValue")
    public abstract ResultT apply(Simulation sim, EntityT entity, TimelineEvent<EventValueT> event);

    @Override
    @SuppressWarnings("unchecked")
    public void replay(Simulation sim) {
        // we need these unsafe casts, as there is no formal guarantee that
        // objects with some identifier always have the same type:
        // in a simulation run, "foobar" could be a train, and could be a
        // signal in another.
        // This won't happen because we pick our identifiers to be unique.
        var entity = (EntityT) sim.getEntity(entityId);
        var event = (TimelineEvent<EventValueT>) sim.getTimelineEvent(timelineEventId);
        this.apply(sim, entity, event);
    }
}