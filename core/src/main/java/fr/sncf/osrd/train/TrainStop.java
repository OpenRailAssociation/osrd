package fr.sncf.osrd.train;

import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.Objects;

public class TrainStop {
    public double position;
    public double duration;

    public TrainStop(double position, double duration) {
        this.position = position;
        this.duration = duration;
    }

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        TrainStop trainStop = (TrainStop) o;
        return Double.compare(trainStop.position, position) == 0
                && Double.compare(trainStop.duration, duration) == 0;
    }

    @Override
    public int hashCode() {
        return Objects.hash(position, duration);
    }
}
