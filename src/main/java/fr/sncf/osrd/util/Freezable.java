package fr.sncf.osrd.util;

public interface Freezable {
    /** Make the object immutable. */
    void freeze();

    boolean isFrozen();
}
