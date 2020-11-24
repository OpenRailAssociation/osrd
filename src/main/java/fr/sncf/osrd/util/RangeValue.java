package fr.sncf.osrd.util;

/** A range of position with an associated value. */
public final class RangeValue<E> {
    public final double start;
    public final double end;
    public final E value;

    public RangeValue(double start, double end, E value) {
        this.start = start;
        this.end = end;
        this.value = value;
    }
}