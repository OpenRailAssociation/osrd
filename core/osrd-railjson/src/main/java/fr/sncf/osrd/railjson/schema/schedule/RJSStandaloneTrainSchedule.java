package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.Identified;
import java.util.Collection;


public class RJSStandaloneTrainSchedule implements Identified {
    /** The identifier of this train */
    public String id;

    /** The identifier of the rolling stock for this train */
    @Json(name = "rolling_stock")
    public String rollingStock;

    /** The speed the train starts the journey with */
    @Json(name = "initial_speed")
    public double initialSpeed;

    /** A list of allowances, which are applied (stacked) in order. */
    public RJSAllowance[] allowances;

    /** List of stops */
    public RJSTrainStop[] stops;

    public Collection<String> tags;

    /** Create a new train schedule */
    public RJSStandaloneTrainSchedule(
            String id,
            String rollingStock,
            double initialSpeed,
            RJSAllowance[] allowances,
            RJSTrainStop[] stops,
            Collection<String> tags
    ) {
        this.id = id;
        this.rollingStock = rollingStock;
        this.initialSpeed = initialSpeed;
        this.allowances = allowances;
        this.stops = stops;
        this.tags = tags;
    }

    @Override
    public String getID() {
        return id;
    }
}
