package fr.sncf.osrd.standalone_sim.result;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

@SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
public class ResultOccupancyTiming {
    @Json(name = "time_head_occupy")
    public final double timeHeadOccupy;

    @Json(name = "time_tail_free")
    public final double timeTailFree;

    /** Directly create an occupancy timing */
    public ResultOccupancyTiming(double timeHeadOccupy, double timeTailFree) {
        this.timeHeadOccupy = timeHeadOccupy;
        this.timeTailFree = timeTailFree;
    }

    public ResultOccupancyTiming withAddedTime(double timeToAdd) {
        return new ResultOccupancyTiming(timeHeadOccupy + timeToAdd, timeTailFree + timeToAdd);
    }
}
