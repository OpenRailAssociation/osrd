package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.RJSTrackLocation;
import fr.sncf.osrd.railjson.schema.infra.RJSRoute;

public class RJSTrainSchedule implements Identified {
    /** The identifier of this train */
    public String id;

    /** The identifier of the rolling stock for this train */
    @Json(name = "rolling_stock")
    public String rollingStock;

    /** The time at which the train should start, in seconds */
    @Json(name = "departure_time")
    public double departureTime = Double.NaN;

    /** The initial state of the train */
    @Json(name = "initial_head_location")
    public RJSTrackLocation initialHeadLocation;
    @Json(name = "initial_speed")
    public double initialSpeed = Double.NaN;

    public RJSTrainPhase[] phases;

    public ID<RJSRoute>[] routes;

    @Json(name = "train_control_method")
    public String trainControlMethod;

    /** What allowance to apply on the train schedule.
     * The double array should be seen as a list of set, each element
     * in one set is applied independently, then each set is applied one after
     * the other with the result of the previous one used as base speed. */
    public RJSAllowance[][] allowances;

    /** List of stops */
    public RJSTrainStop[] stops;

    /** Create a new train schedule */
    public RJSTrainSchedule(
            String id,
            String rollingStock,
            double departureTime,
            RJSTrackLocation initialHeadLocation,
            double initialSpeed,
            RJSTrainPhase[] phases,
            String trainControlMethod,
            RJSAllowance[][] allowances,
            RJSTrainStop[] stops,
            ID<RJSRoute>[] routes
    ) {
        this.id = id;
        this.rollingStock = rollingStock;
        this.departureTime = departureTime;
        this.initialHeadLocation = initialHeadLocation;
        this.initialSpeed = initialSpeed;
        this.phases = phases;
        this.trainControlMethod = trainControlMethod;
        this.allowances = allowances;
        this.stops = stops;
        this.routes = routes;
    }

    @Override
    public String getID() {
        return id;
    }
}
