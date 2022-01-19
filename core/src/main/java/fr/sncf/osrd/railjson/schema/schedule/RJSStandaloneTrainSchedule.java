package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.Identified;


public class RJSStandaloneTrainSchedule implements Identified {
    /** The identifier of this train */
    public String id;

    /** The identifier of the rolling stock for this train */
    @Json(name = "rolling_stock")
    public String rollingStock;

    @Json(name = "initial_speed")
    public double initialSpeed;

    /* What allowance to apply on the train schedule.
     * The double array should be seen as a list of set, each element
     * in one set is applied independently, then each set is applied one after
     * the other with the result of the previous one used as base speed. */
    // TODO: Create a new allowance model
    // public RJSAllowance[][] allowances;

    /** List of stops */
    public RJSTrainStop[] stops;

    /** Create a new train schedule */
    public RJSStandaloneTrainSchedule(
            String id,
            String rollingStock,
            double initialSpeed,
            RJSTrainStop[] stops
    ) {
        this.id = id;
        this.rollingStock = rollingStock;
        this.initialSpeed = initialSpeed;
        this.stops = stops;
    }

    @Override
    public String getID() {
        return id;
    }
}
