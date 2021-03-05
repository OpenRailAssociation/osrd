package fr.sncf.osrd.simulation;


import java.util.List;

public interface Entity<T extends Entity<T>> {
    EntityID<T> getID();

    List<Entity<?>> getSubscribers();

    void onTimelineEventUpdate(
            Simulation sim,
            TimelineEvent<?> event,
            TimelineEvent.State state
    ) throws SimulationError;
}
