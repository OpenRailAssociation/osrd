package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import org.takes.Take;
import java.util.List;

public abstract class PathfindingEndpoint implements Take {
    public static final JsonAdapter<PathfindingRequest> adapterRequest = new Moshi
            .Builder()
            .add(RJSRollingResistance.adapter)
            .build()
            .adapter(PathfindingRequest.class);
    // TODO: add the `.failOnUnknown()` back, which requires adding all extra fields to rolling stock models

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
        @Json(name = "expected_version")
        public final String expectedVersion;

        /** List of rolling stocks that must be able to go through this path */
        @Json(name = "rolling_stocks")
        public List<RJSRollingStock> rollingStocks;

        /** Constructor */
        public PathfindingRequest(PathfindingWaypoint[][] waypoints, String infra) {
            this.waypoints = waypoints;
            this.infra = infra;
            this.expectedVersion = null;
        }

        PathfindingRequest(PathfindingWaypoint[][] waypoints, String infra, String expectedVersion) {
            this.waypoints = waypoints;
            this.infra = infra;
            this.expectedVersion = expectedVersion;
        }
    }

    @SuppressFBWarnings("URF_UNREAD_FIELD")
    protected static class DirectionalTrackRangeResult {
        @Json(name = "track")
        public final RJSObjectRef<RJSTrackSection> trackSection;
        private final double begin;
        private final double end;
        private final EdgeDirection direction;

        protected DirectionalTrackRangeResult(String trackSectionID, double begin, double end) {
            this.trackSection = new RJSObjectRef<>(trackSectionID, "TrackSection");
            this.begin = Math.min(begin, end);
            this.end = Math.max(begin, end);
            this.direction = begin < end ? EdgeDirection.START_TO_STOP : EdgeDirection.STOP_TO_START;
        }

        public double getBegin() {
            if (this.direction == EdgeDirection.START_TO_STOP)
                return this.begin;
            return this.end;
        }

        public double getEnd() {
            if (this.direction == EdgeDirection.START_TO_STOP)
                return this.end;
            return this.begin;
        }
    }
}
