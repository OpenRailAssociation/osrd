package fr.sncf.osrd.utils;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.utils.graph.IPointValue;
import java.util.Objects;

public final class PointValue<ValueT> implements IPointValue<ValueT> {
    public final double position;
    public final ValueT value;

    public PointValue(double position, ValueT value) {
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

    @Override
    public double getPosition() {
        return position;
    }

    @Override
    public ValueT getValue() {
        return value;
    }
}