package fr.sncf.osrd.standalone_sim.result;

import static fr.sncf.osrd.utils.units.Distance.fromMeters;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.sim_infra.api.PathProperties;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.utils.units.Distance;
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

    /** Create a ResultPosition */
    public static ResultPosition from(double time, double pathOffset, PathProperties path, RawSignalingInfra rawInfra) {
        var location = path.getTrackLocationAtOffset(fromMeters(pathOffset));
        return new ResultPosition(
                time,
                pathOffset,
                rawInfra.getTrackSectionName(location.getTrackId()),
                Distance.toMeters(location.getOffset())
        );
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

    /** Returns a new instance of ResultPosition with the given added time */
    public ResultPosition withAddedTime(double timeToAdd) {
        return new ResultPosition(time + timeToAdd, pathOffset, trackSection, offset);
    }
}
