package fr.sncf.osrd.api.pathfinding.response;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;

public class DirTrackRange {
    @Json(name = "track")
    public final RJSObjectRef<RJSTrackSection> trackSection;
    public final double begin;
    public final double end;
    public final EdgeDirection direction;

    /** Create a new directional track range */
    public DirTrackRange(String trackSectionID, double begin, double end) {
        this.trackSection = new RJSObjectRef<>(trackSectionID, "TrackSection");
        if (begin < end) {
            this.direction = EdgeDirection.START_TO_STOP;
            this.begin = begin;
            this.end = end;
        } else {
            this.direction = EdgeDirection.STOP_TO_START;
            this.begin = end;
            this.end = begin;
        }
    }

    /** Returns the offset at which this range starts, taking direction into account */
    public double getBegin() {
        if (this.direction == EdgeDirection.START_TO_STOP)
            return this.begin;
        return this.end;
    }

    /** Returns the offset at which this range ends, taking direction into account */
    public double getEnd() {
        if (this.direction == EdgeDirection.START_TO_STOP)
            return this.end;
        return this.begin;
    }
}
