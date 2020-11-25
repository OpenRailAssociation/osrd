package fr.sncf.osrd.util;

/** A range of position with an associated value. */
public final class RangeValue<E> {
    public final double start;
    public final double end;
    public final E value;

    /**
     * Create a new range with an associated value
     * @param start the included start position
     * @param end the included end position
     * @param value the value on this range
     */
    public RangeValue(double start, double end, E value) {
        this.start = start;
        this.end = end;
        this.value = value;
    }
}