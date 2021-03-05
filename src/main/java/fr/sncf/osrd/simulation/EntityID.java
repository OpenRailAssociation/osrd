package fr.sncf.osrd.simulation;

public interface EntityID<T extends Entity<T>> {
    T getEntity(Simulation sim);
}
