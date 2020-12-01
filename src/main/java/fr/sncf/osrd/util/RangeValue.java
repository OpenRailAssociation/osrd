package fr.sncf.osrd.util;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

/** A range of position with an associated value. */
@SuppressFBWarnings(
        value = "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD",
        justification = "kept for later use"
)
public final class RangeValue<E> {
    public final double begin;
    public final double end;
    public final E value;

    /**
     * Create a new range with an associated value
     * @param begin the included start position
     * @param end the included end position
     * @param value the value on this range
     */
    public RangeValue(double begin, double end, E value) {
        this.begin = begin;
        this.end = end;
        this.value = value;
    }
}