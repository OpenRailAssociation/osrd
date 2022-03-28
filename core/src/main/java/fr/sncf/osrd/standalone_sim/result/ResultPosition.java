package fr.sncf.osrd.standalone_sim.result;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.train.TrainPath;
import java.util.ArrayList;

@SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
public class ResultPosition {
    public final double time;
    @Json(name = "track_section")
    public final String trackSection;
    public final double offset;
    @Json(name = "path_offset")
    public final double pathOffset;

    private ResultPosition(double time, double pathOffset, String trackSection, double offset) {
        this.time = time;
        this.pathOffset = pathOffset;
        this.trackSection = trackSection;
        this.offset = offset;
    }

    public static ResultPosition from(double time, double pathOffset, TrainPath path) {
        var location = path.findLocation(pathOffset);
        return new ResultPosition(time, pathOffset, location.edge.id, location.offset);
    }

    /** Interpolate in a list of positions the time associated to a given position.
     * Note: Using envelope is not possible since the stop duration is not taken into account in envelopes.
     * @param position between 0 and last position
     * @param headPositions list of positions
     */
    public static double interpolateTime(double position, ArrayList<ResultPosition> headPositions) {
        int leftIndex = 0;
        int rightIndex = headPositions.size() - 1;
        assert position >= 0;
        assert position <= headPositions.get(rightIndex).pathOffset;
        // Binary search to find the interval to use for interpolation
        while (rightIndex - leftIndex > 1) {
            int median = (rightIndex + leftIndex) / 2;
            if (position > headPositions.get(median).pathOffset)
                leftIndex = median;
            else
                rightIndex = median;
        }

        var a = headPositions.get(leftIndex);
        var b = headPositions.get(rightIndex);
        return a.time + (position - a.pathOffset) * (b.time - a.time) / (b.pathOffset - a.pathOffset);
    }
}


