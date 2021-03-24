package fr.sncf.osrd.simulation;

public interface Entity<T extends Entity<T>> {
    EntityID<T> getID();
}
