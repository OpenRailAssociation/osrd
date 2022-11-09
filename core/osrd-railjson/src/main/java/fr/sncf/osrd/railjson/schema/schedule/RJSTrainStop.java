package fr.sncf.osrd.railjson.schema.schedule;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.RJSTrackLocation;

/** This class represents a stop on the train path */
public class RJSTrainStop {

    /** Stop position on the track, as a distance to the path start.
     * With a negative value, the stop will be placed at the end of the path.
     * One must be specified between position and location */
    public Double position;

    /** Stop location, as a position on a track
     * One must be specified between position and location */
    @SuppressFBWarnings("UWF_NULL_FIELD")
    public RJSTrackLocation location;

    /** Stop duration */
    public double duration;

    /** Constructor with position */
    public RJSTrainStop(Double position, double duration) {
        this.position = position;
        this.location = null;
        this.duration = duration;
    }

    public static RJSTrainStop lastStop(double duration) {
        return new RJSTrainStop(-1., duration);
    }
}
