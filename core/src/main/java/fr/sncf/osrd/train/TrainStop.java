package fr.sncf.osrd.train;

import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.Objects;

public class TrainStop {
    public double position;
    public double duration;
    public boolean onStopSignal;

    public TrainStop(double position, double duration, boolean onStopSignal) {
        this.position = position;
        this.duration = duration;
        this.onStopSignal = onStopSignal;
    }

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        TrainStop trainStop = (TrainStop) o;
        return Double.compare(trainStop.position, position) == 0 && Double.compare(trainStop.duration, duration) == 0;
    }

    @Override
    public String toString() {
        return "TrainStop{" + "position="
                + position + ", duration="
                + duration + ", onStopSignal="
                + onStopSignal + '}';
    }

    @Override
    public int hashCode() {
        return Objects.hash(position, duration);
    }
}
