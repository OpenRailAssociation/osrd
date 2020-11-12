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
     * @return The unique per collection index.
     */
    int getIndex();
}
