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

    /**
     * State of the signal where the train is received for its stops.
     * For (important) details, see https://osrd.fr/en/docs/reference/design-docs/timetable/#modifiable-fields
     */
    public enum RJSReceptionSignal {
        OPEN,
        STOP,
        SHORT_SLIP_STOP;

        public boolean isStopOnClosedSignal() {
            return this == STOP || this == SHORT_SLIP_STOP;
        }
    }

    @Json(name = "reception_signal")
    public RJSReceptionSignal receptionSignal;

    /** Stop duration */
    public double duration;

    /** Constructor with position */
    public RJSTrainStop(Double position, double duration, RJSReceptionSignal receptionSignal) {
        this.position = position;
        this.location = null;
        this.duration = duration;
        this.receptionSignal = receptionSignal;
    }

    public static RJSTrainStop lastStop(double duration) {
        return new RJSTrainStop(-1., duration, RJSReceptionSignal.SHORT_SLIP_STOP);
    }
}
