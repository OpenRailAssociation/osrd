package fr.sncf.osrd.train;

import com.carrotsearch.hppc.DoubleArrayList;
import fr.sncf.osrd.envelope_sim.allowances.Allowance;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.List;
import java.util.Objects;

public class StandaloneTrainSchedule {
    /** The identifier of the rolling stock for this train */
    public final RollingStock rollingStock;

    public final double initialSpeed;

    public final List<TrainStop> stops;

    public final List<? extends Allowance> allowances;

    public final String tag;

    public final RollingStock.Comfort comfort;

    public final TrainScheduleOptions options;

    /** Standalone Train Schedule constructor */
    public StandaloneTrainSchedule(
            RollingStock rollingStock,
            double initialSpeed,
            List<TrainStop> stops,
            List<? extends Allowance> allowances,
            String tag,
            RollingStock.Comfort comfort,
            TrainScheduleOptions options
    ) {
        this.rollingStock = rollingStock;
        this.initialSpeed = initialSpeed;
        this.stops = stops;
        this.allowances = allowances;
        this.tag = tag;
        this.comfort = comfort;
        this.options = Objects.requireNonNullElseGet(options, () -> new TrainScheduleOptions(null));
    }

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public boolean equals(Object o) {
        if (this == o)
            return true;
        if (o == null || getClass() != o.getClass())
            return false;
        var other = (StandaloneTrainSchedule) o;
        return Double.compare(other.initialSpeed, initialSpeed) == 0
                && rollingStock.equals(other.rollingStock)
                && stops.equals(other.stops)
                && allowances.equals(other.allowances)
                && comfort == other.comfort
                && options.equals(other.options);
    }

    @Override
    public int hashCode() {
        return Objects.hash(rollingStock, initialSpeed, stops, allowances, comfort, options);
    }

    /**
     * Returns an array of stop positions (stop with a duration of 0 are ignored)
     */
    public double[] getStopsPositions() {
        var stopPositions = new DoubleArrayList();
        for (var stop : stops) {
            if (stop.duration > 0)
                stopPositions.add(stop.position);
        }
        return stopPositions.toArray();
    }
}
