package fr.sncf.osrd.api.pathfinding.response;

import com.google.common.base.MoreObjects;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.Objects;

/** A point in the slope chart in the pathfinding response payload. */
public class SlopeChartPointResult {
    /**
     * The position of the slope
     */
    public double position = 0;
    /**
     * The slope gradient
     */
    public double gradient = 0;

    public SlopeChartPointResult(double position, double gradient) {
        this.position = position;
        this.gradient = gradient;
    }


    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SlopeChartPointResult that = (SlopeChartPointResult) o;
        return Double.compare(that.position, position) == 0 && Double.compare(
                that.gradient,
                gradient
        ) == 0;
    }

    @Override
    public int hashCode() {
        return Objects.hash(position, gradient);
    }

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("position", position)
                .add("gradient", gradient)
                .toString();
    }
}
