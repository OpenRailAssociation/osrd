package fr.sncf.osrd.railjson.schema.schedule;

/** A fixed time waypoint on the train path */
public class RJSSchedulePoint {

    /** Fixed point location, as a distance from the start of the path.
     * When negative, the fixed point is inferred to be at the end of the path. */
    public double position;

    /** Time at which the train should reach the given position. */
    public double time;

    /** Constructor with position */
    public RJSSchedulePoint(double position, double time) {
        this.position = position;
        this.time = time;
    }

    public static RJSSchedulePoint lastStop(double time) {
        return new RJSSchedulePoint(-1., time);
    }
}
