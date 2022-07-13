package fr.sncf.osrd.standalone_sim.result;

import static fr.sncf.osrd.standalone_sim.result.ResultPosition.interpolateTime;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.util.ArrayList;

@SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
public class ResultOccupancyTiming {
    @Json(name = "time_head_occupy")
    public final double timeHeadOccupy;
    @Json(name = "time_head_free")
    public final double timeHeadFree;
    @Json(name = "time_tail_occupy")
    public final double timeTailOccupy;
    @Json(name = "time_tail_free")
    public final double timeTailFree;

    /** Directly create an occupancy timing */
    public ResultOccupancyTiming(
            double timeHeadOccupy,
            double timeHeadFree,
            double timeTailOccupy,
            double timeTailFree
    ) {
        this.timeHeadOccupy = timeHeadOccupy;
        this.timeHeadFree = timeHeadFree;
        this.timeTailOccupy = timeTailOccupy;
        this.timeTailFree = timeTailFree;
    }

    /**
     * Finds the occupancy on a given section
     * @param startPosition the start of the target region
     * @param endPosition the end of the target region
     * @param headPositions the envelope of the head of the train
     * @param trainLength the length of the train
     * @return the occupancy times for this section
     */
    public static ResultOccupancyTiming fromPositions(
            double startPosition,
            double endPosition,
            ArrayList<ResultPosition> headPositions,
            double trainLength
    ) {
        var timeHeadFree = interpolateTime(endPosition, headPositions);
        var timeHeadOccupy = interpolateTime(startPosition, headPositions);
        var pathLength = headPositions.get(headPositions.size() - 1).pathOffset;
        var timeTailFree = interpolateTime(Math.min(pathLength, endPosition + trainLength), headPositions);
        double timeTailOccupy = 0;
        // Special case for first route
        if (startPosition > 0)
            timeTailOccupy = interpolateTime(Math.min(pathLength, startPosition + trainLength), headPositions);
        return new ResultOccupancyTiming(timeHeadOccupy, timeHeadFree, timeTailOccupy, timeTailFree);
    }
}
