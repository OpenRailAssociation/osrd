package fr.sncf.osrd.api.pathfinding.request;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;

/** Creates a pathfinding waypoint */
public record PathfindingWaypoint(
        @Json(name = "track_section")
        String trackSection,
        double offset,
        EdgeDirection direction
) {
}
