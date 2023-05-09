package fr.sncf.osrd.api.pathfinding.response;

import com.google.common.base.MoreObjects;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.Objects;

/** A point in the curve chart in the pathfinding response payload. */
public class CurveChartPointResult {
    public double position;
    public double radius;

    public CurveChartPointResult(double position, double radius) {
        this.position = position;
        this.radius = radius;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        CurveChartPointResult that = (CurveChartPointResult) o;
        return Double.compare(that.position, position) == 0 && Double.compare(that.radius, radius) == 0;
    }

    @Override
    public int hashCode() {
        return Objects.hash(position, radius);
    }

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("position", position)
                .add("radius", radius)
                .toString();
    }
}
