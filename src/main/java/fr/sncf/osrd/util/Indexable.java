package fr.sncf.osrd.util;

/**
 * Applies to objects that have an index inside some collection.
 */
public interface Indexable {
    /**
     * Sets the collection index.
     * Should not be called twice.
     * @param index the index of the object in the collection
     */
    void setIndex(int index);

    /**
     * Returns the collection index.
     * @return the index of the object in the collection
     */
    int getIndex();
}
