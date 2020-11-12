package fr.sncf.osrd.infra;

/**
 * Applies to objects that have an index inside some collection.
 */
public abstract class Indexed {
    private long index = -1;

    /**
     * Sets the collection index.
     * Should not be called twice.
     */
    public final void setIndex(long index) {
        assert index == -1;
        this.index = index;
    }

    /**
     * @return The unique per collection index.
     */
    public final long getIndex() {
        assert index != -1;
        return index;
    }
}
