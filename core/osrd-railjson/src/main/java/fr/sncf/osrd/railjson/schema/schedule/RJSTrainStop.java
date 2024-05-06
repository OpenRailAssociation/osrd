package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.RJSTrackLocation;

/** This class represents a stop on the train path */
public class RJSTrainStop {

    /**
     * Stop position on the track, as a distance to the path start. With a negative value, the stop
     * will be placed at the end of the path. One must be specified between position and location
     */
    public Double position;

    /**
     * Stop location, as a position on a track One must be specified between position and location
     */
    @SuppressFBWarnings("UWF_NULL_FIELD")
    public RJSTrackLocation location;

    @Json(name = "on_stop_signal")
    public boolean onStopSignal;

    /** Stop duration */
    public double duration;

    /** Constructor with position */
    public RJSTrainStop(Double position, double duration, boolean onStopSignal) {
        this.position = position;
        this.location = null;
        this.duration = duration;
        this.onStopSignal = onStopSignal;
    }

    public static RJSTrainStop lastStop(double duration) {
        return new RJSTrainStop(-1., duration, true);
    }
}
