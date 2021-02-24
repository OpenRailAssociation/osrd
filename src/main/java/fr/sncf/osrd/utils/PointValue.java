package fr.sncf.osrd.utils;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

import java.util.Objects;

public final class PointValue<E> {
    public final double position;
    public final E value;

    public PointValue(double position, E value) {
        this.position = position;
        this.value = value;
    }

    @Override
    public int hashCode() {
        return Objects.hash(position, value);
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

        var o = (PointValue<?>) obj;
        return position == o.position && value == o.value;
    }
}