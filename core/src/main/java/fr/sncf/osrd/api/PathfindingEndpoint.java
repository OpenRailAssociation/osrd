package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
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
        public final long version;

        public PathfindingRequest(PathfindingWaypoint[][] waypoints, String infra, long version) {
            this.waypoints = waypoints;
            this.infra = infra;
            this.version = version;
        }
    }

    @SuppressFBWarnings("URF_UNREAD_FIELD")
    protected static class DirectionalTrackRangeResult {
        @Json(name = "track")
        public final RJSObjectRef<RJSTrackSection> trackSection;
        public final double begin;
        public final double end;
        private final EdgeDirection direction;

        protected DirectionalTrackRangeResult(String trackSectionID, double begin, double end) {
            this.trackSection = new RJSObjectRef<>(trackSectionID, "TrackSection");
            this.begin = begin;
            this.end = end;
            this.direction = begin < end ? EdgeDirection.START_TO_STOP : EdgeDirection.STOP_TO_START;
        }
    }
}
