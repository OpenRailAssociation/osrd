package fr.sncf.osrd.api.pathfinding.request;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;

public final class PathfindingWaypoint {
    @Json(name = "track_section")
    public String trackSection;
    public double offset = Double.NaN;
    public EdgeDirection direction;

    /** Creates a pathfinding waypoint */
    public PathfindingWaypoint(
            String trackSection,
            double offset,
            EdgeDirection direction
    ) {
        this.trackSection = trackSection;
        this.offset = offset;
        this.direction = direction;
    }

    public PathfindingWaypoint() {
    }
}
