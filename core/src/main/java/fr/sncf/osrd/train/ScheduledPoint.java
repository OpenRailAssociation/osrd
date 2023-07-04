package fr.sncf.osrd.train;

import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.Objects;

public class ScheduledPoint {
    public double pathOffset;
    public double time;


    public ScheduledPoint(double pathOffset, double time) {
        this.pathOffset = pathOffset;
        this.time = time;
    }

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ScheduledPoint trainStop = (ScheduledPoint) o;
        return Double.compare(trainStop.pathOffset, pathOffset) == 0
                && Double.compare(trainStop.time, time) == 0;
    }

    @Override
    public int hashCode() {
        return Objects.hash(pathOffset, time);
    }
}
