package fr.sncf.osrd.standalone_sim.result;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

@SuppressFBWarnings("URF_UNREAD_FIELD")
public class ResultStops {
    double time;
    double position;
    double duration;

    /** RestultStops constructor */
    public ResultStops(double time, double position, double duration) {
        this.time = time;
        this.position = position;
        this.duration = duration;
    }
}