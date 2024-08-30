package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort;

public class RJSStandaloneTrainSchedule implements Identified {
    /** The identifier of this train */
    public String id;

    /** The identifier of the rolling stock for this train */
    @Json(name = "rolling_stock")
    public String rollingStock;

    /** The speed the train starts the journey with */
    @Json(name = "initial_speed")
    public double initialSpeed;

    /**
     * The time at which the train should start, in seconds. Ignored in the endpoint, used in cli
     */
    @Json(name = "departure_time")
    public double departureTime;

    /** A list of scheduled points */
    @Json(name = "scheduled_points")
    public RJSSchedulePoint[] scheduledPoints;

    /** A list of allowances, which are applied (stacked) in order. */
    public RJSAllowance[] allowances;

    /** List of stops */
    public RJSTrainStop[] stops;

    public String tag;

    /** The type of comfort the train using */
    public Comfort comfort;

    /** Ranges on the path where power restrictions are to be applied */
    @Json(name = "power_restriction_ranges")
    public RJSPowerRestrictionRange[] powerRestrictionRanges;

    /** Options for the standalone simulation */
    public RJSTrainScheduleOptions options;

    /** Create a new train schedule */
    public RJSStandaloneTrainSchedule(
            String id,
            String rollingStock,
            double initialSpeed,
            RJSAllowance[] allowances,
            RJSTrainStop[] stops,
            String tag,
            Comfort comfort,
            RJSTrainScheduleOptions options,
            RJSPowerRestrictionRange[] powerRestrictionRanges) {
        this.id = id;
        this.rollingStock = rollingStock;
        this.initialSpeed = initialSpeed;
        this.allowances = allowances;
        this.stops = stops;
        this.tag = tag;
        this.comfort = comfort;
        this.options = options;
        this.powerRestrictionRanges = powerRestrictionRanges;
    }

    public RJSStandaloneTrainSchedule(
            String id,
            String rollingStock,
            double initialSpeed,
            RJSAllowance[] allowances,
            RJSTrainStop[] stops,
            String tag) {
        this(id, rollingStock, initialSpeed, allowances, stops, tag, Comfort.STANDARD, null, null);
    }

    public RJSStandaloneTrainSchedule(
            String id,
            String rollingStock,
            double initialSpeed,
            RJSSchedulePoint[] scheduledPoints,
            RJSTrainStop[] stops) {
        this.id = id;
        this.rollingStock = rollingStock;
        this.initialSpeed = initialSpeed;
        this.scheduledPoints = scheduledPoints;
        this.stops = stops;
    }

    @Override
    public String getID() {
        return id;
    }
}
