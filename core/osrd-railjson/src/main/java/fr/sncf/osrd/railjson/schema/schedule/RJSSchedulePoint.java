package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;

/** A fixed time waypoint on the train path */
public class RJSSchedulePoint {

    /** Fixed point location, as a distance from the start of the path.
     * When negative, the fixed point is inferred to be at the end of the path. */
    @Json(name = "path_offset")
    public double pathOffset;

    /** Time at which the train should reach the given position. */
    public double time;

    /** Constructor with position */
    public RJSSchedulePoint(double pathOffset, double time) {
        this.pathOffset = pathOffset;
        this.time = time;
    }

    public static RJSSchedulePoint lastStop(double time) {
        return new RJSSchedulePoint(-1., time);
    }
}
