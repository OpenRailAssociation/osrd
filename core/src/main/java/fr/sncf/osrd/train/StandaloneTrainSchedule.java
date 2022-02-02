package fr.sncf.osrd.train;

import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import java.util.ArrayList;
import java.util.Objects;

public class StandaloneTrainSchedule {
    /** The identifier of the rolling stock for this train */
    public final RollingStock rollingStock;

    public final double initialSpeed;

    public final ArrayList<TrainStop> stops;

    public final ArrayList<MarecoAllowance> allowances;

    /** Standalone Train Schedule constructor */
    public StandaloneTrainSchedule(
            RollingStock rollingStock,
            double initialSpeed,
            ArrayList<TrainStop> stops,
            ArrayList<MarecoAllowance> allowances
    ) {
        this.rollingStock = rollingStock;
        this.initialSpeed = initialSpeed;
        this.stops = stops;
        this.allowances = allowances;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o)
            return true;
        if (o == null || getClass() != o.getClass())
            return false;
        var other = (StandaloneTrainSchedule) o;
        return Double.compare(other.initialSpeed, initialSpeed) == 0
                && rollingStock.equals(other.rollingStock)
                && stops.equals(other.stops)
                && allowances.equals(other.allowances);
    }

    @Override
    public int hashCode() {
        return Objects.hash(rollingStock, initialSpeed, stops, allowances);
    }
}
