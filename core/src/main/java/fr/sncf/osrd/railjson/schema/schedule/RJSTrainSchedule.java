package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.RJSTrackLocation;
import fr.sncf.osrd.railjson.schema.infra.RJSRoute;
import java.util.List;

public class RJSTrainSchedule implements Identified {
    /** The identifier of this train */
    public String id;

    /** The identifier of the rolling stock for this train */
    @Json(name = "rolling_stock")
    public String rollingStock;

    /** The time at which the train should start, in seconds */
    @Json(name = "departure_time")
    public double departureTime;

    /** The initial state of the train */
    @Json(name = "initial_head_location")
    public RJSTrackLocation initialHeadLocation;
    @Json(name = "initial_speed")
    public double initialSpeed = Double.NaN;

    public ID<RJSRoute>[] routes;

    /** List of stops */
    public RJSTrainStop[] stops;

    /** The delay in seconds between the previous train and this train.
     * Can only be specified if previous_train_id is also set. Defaults to 0. */
    @Json(name = "train_transition_delay")
    public double trainTransitionDelay;

    /** Create a new train schedule */
    public RJSTrainSchedule(
            String id,
            String rollingStock,
            double departureTime,
            RJSTrackLocation initialHeadLocation,
            double initialSpeed,
            RJSTrainStop[] stops,
            ID<RJSRoute>[] routes,
            double trainTransitionDelay
    ) {
        this.id = id;
        this.rollingStock = rollingStock;
        this.departureTime = departureTime;
        this.initialHeadLocation = initialHeadLocation;
        this.initialSpeed = initialSpeed;
        this.stops = stops;
        this.routes = routes;
        this.trainTransitionDelay = trainTransitionDelay;
    }

    /** Copy constructor */
    public RJSTrainSchedule(RJSTrainSchedule other) {
        this(other.id, other.rollingStock, other.departureTime, other.initialHeadLocation, other.initialSpeed,
                other.stops, other.routes, other.trainTransitionDelay);
    }

    @Override
    public String getID() {
        return id;
    }
}