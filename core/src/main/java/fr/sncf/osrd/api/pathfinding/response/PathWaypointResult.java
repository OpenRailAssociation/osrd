package fr.sncf.osrd.api.pathfinding.response;

import fr.sncf.osrd.infra.api.tracks.undirected.OperationalPoint;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackSection;
import fr.sncf.osrd.railjson.schema.common.RJSWaypointRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;

/**
 * One waypoint in the path, represents an operational point
 */
public class PathWaypointResult {
    /**
     * ID if the operational point
     */
    public String id;
    /**
     * A point is a suggestion if it's not part of the input path and just an OP on the path
     */
    public boolean suggestion;
    /**
     * Track the point is on
     */
    public String track;
    /**
     * Offset of the point on the track
     */
    public double position;
    /**
     * Used to sort the waypoint, not a part of the actual response (transient)
     */
    public final transient double trackRangeOffset;

    /**
     * Constructor
     */
    private PathWaypointResult(
            String trackID,
            double offset,
            boolean suggestion,
            String opID,
            double trackRangeOffset
    ) {
        this.suggestion = suggestion;
        this.track = trackID;
        this.position = offset;
        this.id = opID;
        this.trackRangeOffset = trackRangeOffset;
    }

    /**
     * Creates a suggested waypoint from an OP
     */
    public static PathWaypointResult suggestion(
            OperationalPoint op, TrackSection trackSection, double trackRangeOffset
    ) {
        return new PathWaypointResult(trackSection.getID(), op.offset(), true, op.id(), trackRangeOffset);
    }

    /**
     * Creates a user defined waypoint
     */
    public static PathWaypointResult userDefined(TrackLocation location, double trackRangeOffset) {
        return new PathWaypointResult(location.track().getID(), location.offset(), false, null, trackRangeOffset);
    }


    /**
     * Check if two steps result are at the same location
     */
    public boolean isDuplicate(PathWaypointResult other) {
        if (!track.equals(other.track))
            return false;
        return Math.abs(position - other.position) < 0.001;
    }

    /**
     * Merge a suggested with a give step
     */
    public void merge(PathWaypointResult other) {
        suggestion &= other.suggestion;
        if (!other.suggestion)
            return;
        position = other.position;
        id = other.id;
    }
}
