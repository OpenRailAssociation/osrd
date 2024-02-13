package fr.sncf.osrd.standalone_sim.result;

import static fr.sncf.osrd.utils.units.Distance.fromMeters;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.sim_infra.api.PathProperties;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.utils.units.Distance;

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
                Distance.toMeters(location.getOffset()));
    }

    /** Returns a new instance of ResultPosition with the given added time */
    public ResultPosition withAddedTime(double timeToAdd) {
        return new ResultPosition(time + timeToAdd, pathOffset, trackSection, offset);
    }
}
