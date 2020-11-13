package fr.sncf.osrd.util;

/**
 * Applies to objects that have an index inside some collection.
 */
public interface Indexable {
    /**
     * Sets the collection index.
     * Should not be called twice.
     */
    void setIndex(int index);

    /**
     * Returns the collection index.
     */
    int getIndex();
}
