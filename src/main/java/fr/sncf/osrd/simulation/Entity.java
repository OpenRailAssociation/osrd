package fr.sncf.osrd.simulation;


import java.util.List;

public interface Entity<T extends Entity<T>> {
    EntityID<T> getID();

    List<Entity<?>> getSubscribers();

    void onEventOccurred(
            Simulation sim,
            TimelineEvent<?> event
    ) throws SimulationError;

    void onEventCancelled(
            Simulation sim,
            TimelineEvent<?> event
    ) throws SimulationError;
}
