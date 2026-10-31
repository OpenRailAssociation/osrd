package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.api.StopType;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.Objects;

public class TrainStop {
    public double position;
    public double duration;
    public RJSReceptionSignal receptionSignal;
    // This field is not used yet, it will be forwarded to the frontend later
    @SuppressFBWarnings
    public StopType stopType;

    public TrainStop(double position, double duration, RJSReceptionSignal receptionSignal, StopType stopType) {
        this.position = position;
        this.duration = duration;
        this.receptionSignal = receptionSignal;
        this.stopType = stopType;
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
                + duration + ", receptionSignal="
                + receptionSignal + '}';
    }

    @Override
    public int hashCode() {
        return Objects.hash(position, duration);
    }
}
