package fr.sncf.osrd.simulation;

@SuppressWarnings("UnusedReturnValue")
public abstract class EntityEventChange<
        EntityT extends Entity<EntityT>,
        EntityIDT extends EntityID<EntityT>,
        EventValueT extends TimelineEventValue,
        ResultT
        > extends Change {
    public final TimelineEventId timelineEventId;
    public final EntityIDT entityId;

    protected EntityEventChange(Simulation sim, EntityIDT entityId, TimelineEvent<EventValueT> timelineEvent) {
        super(sim);
        this.entityId = entityId;
        this.timelineEventId = new TimelineEventId(timelineEvent);
    }

    @SuppressWarnings("SameReturnValue")
    public abstract ResultT apply(Simulation sim, EntityT entity, TimelineEvent<EventValueT> event);

    @Override
    @SuppressWarnings("unchecked")
    public void replay(Simulation sim) {
        var entity = entityId.getEntity(sim);
        var event = (TimelineEvent<EventValueT>) sim.getTimelineEvent(timelineEventId);
        this.apply(sim, entity, event);
    }
}