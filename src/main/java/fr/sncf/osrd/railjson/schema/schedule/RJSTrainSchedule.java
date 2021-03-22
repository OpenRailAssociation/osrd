package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.RJSTrackLocation;
import fr.sncf.osrd.railjson.schema.infra.RJSRoute;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;

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
    @Json(name = "initial_head_location")
    public final RJSTrackLocation initialHeadLocation;
    @Json(name = "initial_route")
    public final ID<RJSRoute> initialRoute;
    @Json(name = "initial_speed")
    public final double initialSpeed;

    public final RJSTrainPhase[] phases;

    /** Create a new train schedule */
    public RJSTrainSchedule(
            String id,
            ID<RJSRollingStock> rollingStock,
            double departureTime,
            RJSTrackLocation initialHeadLocation,
            ID<RJSRoute> initialRoute,
            double initialSpeed,
            RJSTrainPhase[] phases
    ) {
        this.id = id;
        this.rollingStock = rollingStock;
        this.departureTime = departureTime;
        this.initialHeadLocation = initialHeadLocation;
        this.initialRoute = initialRoute;
        this.initialSpeed = initialSpeed;
        this.phases = phases;
    }

    @Override
    public String getID() {
        return id;
    }
}
