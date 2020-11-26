package fr.sncf.osrd.util;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

/** A range of position with an associated value. */
@SuppressFBWarnings(
        value = "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD",
        justification = "kept for later use"
)
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