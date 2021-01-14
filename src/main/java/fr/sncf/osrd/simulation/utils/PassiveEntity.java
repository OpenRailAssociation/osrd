package fr.sncf.osrd.simulation.utils;

/**
 * A convenience class for an Entity that doesn't react to events.
 */
public class PassiveEntity extends Entity {
    public PassiveEntity(String entityId) {
        super(entityId);
    }

    @Override
    protected void timelineEventUpdate(
            Simulation sim,
            TimelineEvent<?> event,
            TimelineEvent.State state
    ) {
    }
}
