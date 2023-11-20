package fr.sncf.osrd.api.pathfinding.response

import com.squareup.moshi.Json
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings
import java.util.*
import kotlin.math.abs

/**
 * One waypoint in the path, represents an operational point
 */
class PathWaypointResult(
    /**
     * Track location
     */
    var location: PathWaypointLocation,
    /**
     * Waypoint position on the path
     */
    @Json(name = "path_offset") var pathOffset: Double,
    /**
     * A point is a suggestion if it's not part of the input path and just an OP on the path
     */
    var suggestion: Boolean,
    /**
     * ID if the operational point
     */
    var id: String?
) {
    /**
     * Check if two steps result are at the same location
     */
    fun isDuplicate(other: PathWaypointResult): Boolean {
        // Don't merge user-defined waypoints even if they're on the same location
        return if (!suggestion && !other.suggestion)
            false
        else
            abs(pathOffset - other.pathOffset) < 0.001
    }

    /**
     * Merge a suggested with a give step
     */
    fun merge(other: PathWaypointResult) {
        suggestion = suggestion and other.suggestion
        if (!other.suggestion)
            return
        pathOffset = other.pathOffset
        id = other.id
    }

    override fun equals(other: Any?): Boolean {
        if (this === other)
            return true
        return if (other !is PathWaypointResult)
            false
        else
            id == other.id && suggestion == other.suggestion && location == other.location
                    && pathOffset.compareTo(other.pathOffset) == 0
    }

    override fun hashCode(): Int {
        return Objects.hash(id, suggestion, location, pathOffset)
    }

    @SuppressFBWarnings("UWF_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD")
    class PathWaypointLocation(
        @Json(name = "track_section")
        val trackSection: String,
        val offset: Double
    ) {
        override fun equals(other: Any?): Boolean {
            if (this === other)
                return true
            return if (other !is PathWaypointLocation)
                false
            else
                trackSection == other.trackSection && offset.compareTo(other.offset) == 0
        }

        override fun hashCode(): Int {
            return Objects.hash(trackSection, offset)
        }
    }
}
