package fr.sncf.osrd.train;

import java.util.ArrayList;
import java.util.Objects;

public class StandaloneTrainSchedule {
    /** The identifier of the rolling stock for this train */
    public RollingStock rollingStock;

    public double initialSpeed;

    public ArrayList<TrainStop> stops;

    /** Standalone Train Schedule constructor */
    public StandaloneTrainSchedule(
            String id,
            RollingStock rollingStock,
            double initialSpeed,
            ArrayList<TrainStop> stops
    ) {
        this.rollingStock = rollingStock;
        this.initialSpeed = initialSpeed;
        this.stops = stops;
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
                && stops.equals(other.stops);
    }

    @Override
    public int hashCode() {
        return Objects.hash(rollingStock, initialSpeed, stops);
    }
}
