package fr.sncf.osrd.utils;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

import java.util.Objects;

/** A range of position with an associated value. */
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

    @Override
    public int hashCode() {
        return Objects.hash(begin, end, value);
    }

    @Override
    @SuppressFBWarnings(
            value = "FE_FLOATING_POINT_EQUALITY",
            justification = "there is no need for tolerance here for now"
    )
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (this.getClass() != obj.getClass())
            return false;

        var o = (RangeValue<?>) obj;

        boolean hasValue = value != null;
        boolean otherHasValue = o.value != null;
        if (hasValue != otherHasValue)
            return false;

        if (hasValue && otherHasValue) {
            if (!value.equals(o.value))
                return false;
        }

        return begin == o.begin && end == o.end;
    }
}