package fr.sncf.osrd.railjson.schema.infra.trackranges;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;

public class RJSDirectionalTrackRange {
    @Json(name = "track")
    public final String trackSection;
    private final double begin;
    private final double end;
    public final EdgeDirection direction;

    /** RailJSON Directional Track Range constructor */
    public RJSDirectionalTrackRange(String trackSection, double begin, double end, EdgeDirection direction) {
        this.trackSection = trackSection;
        this.begin = begin;
        this.end = end;
        this.direction = direction;
    }

    /** Create a new directional track range and determine direction automatically */
    public RJSDirectionalTrackRange(String trackSectionID, double begin, double end) {
        this.trackSection = trackSectionID;
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

    /**
     * Return the begin offset of the track range
     * This function takes into account the direction so the value can be greater than getEnd()
     */
    public double getBegin() {
        if (direction == EdgeDirection.START_TO_STOP)
            return begin;
        return end;
    }

    /**
     * Return the end offset of the track range
     * This function takes into account the direction so the value can be smaller than getBegin()
     */
    public double getEnd() {
        if (direction == EdgeDirection.START_TO_STOP)
            return end;
        return begin;
    }
}
