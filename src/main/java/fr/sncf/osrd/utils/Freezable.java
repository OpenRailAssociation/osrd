package fr.sncf.osrd.utils;

public interface Freezable {
    /** Make the object immutable. */
    void freeze();

    boolean isFrozen();
}
