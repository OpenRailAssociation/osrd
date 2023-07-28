package fr.sncf.osrd.api.pathfinding.response;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.util.Objects;

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
     * Track location
     */
    public PathWaypointLocation location;
    /**
     * Waypoint position on the path
     */
    @Json(name = "path_offset")
    public double pathOffset;

    /**
     * Constructor
     */
    public PathWaypointResult(
            PathWaypointLocation location,
            double pathOffset,
            boolean suggestion,
            String opID
    ) {
        this.location = location;
        this.pathOffset = pathOffset;
        this.suggestion = suggestion;
        this.id = opID;
    }

    /**
     * Check if two steps result are at the same location
     */
    public boolean isDuplicate(PathWaypointResult other) {
        // Don't merge user-defined waypoints even if they're on the same location
        if (!suggestion && !other.suggestion)
            return false;
        return Math.abs(pathOffset - other.pathOffset) < 0.001;
    }

    /**
     * Merge a suggested with a give step
     */
    public void merge(PathWaypointResult other) {
        suggestion &= other.suggestion;
        if (!other.suggestion)
            return;
        pathOffset = other.pathOffset;
        id = other.id;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof PathWaypointResult pathWaypointResult)) return false;
        return Objects.equals(id, pathWaypointResult.id)
                && Objects.equals(suggestion, pathWaypointResult.suggestion)
                && Objects.equals(location, pathWaypointResult.location)
                && Double.compare(pathOffset, pathWaypointResult.pathOffset) == 0;

    }

    @Override
    public int hashCode() {
        return Objects.hash(id, suggestion, location, pathOffset);
    }

    @SuppressFBWarnings("UWF_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD")
    public static class PathWaypointLocation {
        @Json(name = "track_section")
        public final String trackSection;
        public final double offset;

        public PathWaypointLocation(String trackSection, double offset) {
            this.trackSection = trackSection;
            this.offset = offset;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof PathWaypointLocation location)) return false;
            return Objects.equals(trackSection, location.trackSection)
                    && Double.compare(offset, location.offset) == 0;
        }

        @Override
        public int hashCode() {
            return Objects.hash(trackSection, offset);
        }
    }
}
