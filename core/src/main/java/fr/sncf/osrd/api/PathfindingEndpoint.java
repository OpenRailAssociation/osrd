package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import org.takes.Take;

public abstract class PathfindingEndpoint implements Take {
    public static final JsonAdapter<PathfindingRequest> adapterRequest = new Moshi
            .Builder()
            .build()
            .adapter(PathfindingRequest.class)
            .failOnUnknown();

    protected final InfraManager infraManager;

    public PathfindingEndpoint(InfraManager infraManager) {
        this.infraManager = infraManager;
    }

    public static final class PathfindingWaypoint {
        @Json(name = "track_section")
        public final String trackSection;
        public final double offset;
        public final EdgeDirection direction;

        /** Creates a pathfinding waypoint */
        public PathfindingWaypoint(String trackSection, double offset, EdgeDirection direction) {
            this.trackSection = trackSection;
            this.offset = offset;
            this.direction = direction;
        }
    }

    public static final class PathfindingRequest {
        /**
         * A list of points the train must to through
         * [[starting_point_a, starting_point_b], [waypoint], [end_a, end_b]]
         */
        public final PathfindingWaypoint[][] waypoints;
        public final String infra;

        public PathfindingRequest(PathfindingWaypoint[][] waypoints, String infra) {
            this.waypoints = waypoints;
            this.infra = infra;
        }
    }

    @SuppressFBWarnings({"URF_UNREAD_FIELD"})
    protected static class TrackSectionRangeResult {
        @Json(name = "track_section")
        private final String trackSection;
        private final double begin;
        private final double end;

        protected TrackSectionRangeResult(String trackSection, double beginPosition, double endPosition) {
            this.trackSection = trackSection;
            this.begin = beginPosition;
            this.end = endPosition;
        }
    }
}
