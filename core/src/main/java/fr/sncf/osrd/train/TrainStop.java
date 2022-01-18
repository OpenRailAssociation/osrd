package fr.sncf.osrd.train;

import java.util.Objects;

public class TrainStop {
    public double position;
    public double stopDuration;

    public TrainStop(double position, double stopDuration) {
        this.position = position;
        this.stopDuration = stopDuration;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        TrainStop trainStop = (TrainStop) o;
        return Double.compare(trainStop.position, position) == 0
                && Double.compare(trainStop.stopDuration, stopDuration) == 0;
    }

    @Override
    public int hashCode() {
        return Objects.hash(position, stopDuration);
    }
}
