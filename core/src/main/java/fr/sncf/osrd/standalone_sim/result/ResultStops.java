package fr.sncf.osrd.standalone_sim.result;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

@SuppressFBWarnings("URF_UNREAD_FIELD")
public class ResultStops {
    double time;
    double position;
    double duration;
    @Json(name = "line_code")
    int lineCode;
    @Json(name = "track_number")
    int trackNumber;

    /** RestultStops constructor */
    public ResultStops(double time, double position, double duration, int lineCode, int trackNumber) {
        this.time = time;
        this.position = position;
        this.duration = duration;
        this.lineCode = lineCode;
        this.trackNumber = trackNumber;
    }
}