package fr.sncf.osrd.railjson.simulation.schedule;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.common.ID;
import fr.sncf.osrd.railjson.common.Identified;
import fr.sncf.osrd.railjson.common.RJSTrackRange;
import fr.sncf.osrd.railjson.simulation.rollingstock.RJSRollingStock;

public class RJSTrainSchedule implements Identified {
    /** The identifier of this train */
    public final String id;

    /** The identifier of the rolling stock for this train */
    @Json(name = "rolling_stock")
    public final ID<RJSRollingStock> rollingStock;

    /** The time at which the train should start, in seconds */
    @Json(name = "departure_time")
    public final double departureTime;

    /** The initial state of the train */
    @Json(name = "initial_location")
    public final RJSTrackRange[] initialLocation;
    @Json(name = "initial_speed")
    public final double initialSpeed;

    public final RJSTrainPhase[] phases;

    /** Create a new train schedule */
    public RJSTrainSchedule(
            String id,
            ID<RJSRollingStock> rollingStock,
            double departureTime,
            RJSTrackRange[] initialLocation,
            double initialSpeed,
            RJSTrainPhase[] phases
    ) {
        this.id = id;
        this.rollingStock = rollingStock;
        this.departureTime = departureTime;
        this.initialLocation = initialLocation;
        this.initialSpeed = initialSpeed;
        this.phases = phases;
    }

    @Override
    public String getID() {
        return id;
    }
}
