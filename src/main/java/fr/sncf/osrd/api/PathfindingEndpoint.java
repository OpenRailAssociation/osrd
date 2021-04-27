package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.routegraph.RouteLocation;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.utils.graph.Dijkstra;
import fr.sncf.osrd.utils.graph.DistCostFunction;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.path.BasicPathNode;
import fr.sncf.osrd.utils.graph.path.FullPathArray;
import org.takes.Request;
import org.takes.Response;
import org.takes.Take;
import org.takes.rs.RsJson;
import org.takes.rs.RsText;
import org.takes.rs.RsWithBody;
import org.takes.rs.RsWithStatus;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public abstract class PathfindingEndpoint implements Take {
    public static final JsonAdapter<PathfindingRequest> adapterRequest = new Moshi
            .Builder()
            .build()
            .adapter(PathfindingRequest.class)
            .failOnUnknown();

    protected final Infra infra;

    public PathfindingEndpoint(Infra infra) {
        this.infra = infra;
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

        public PathfindingRequest(PathfindingWaypoint[][] waypoints) {
            this.waypoints = waypoints;
        }
    }

    @SuppressFBWarnings({"URF_UNREAD_FIELD"})
    protected static class TrackSectionRangeResult {
        @Json(name = "track_section")
        private final String trackSection;
        @Json(name = "begin_position")
        private final double beginPosition;
        @Json(name = "end_position")
        private final double endPosition;

        protected TrackSectionRangeResult(String trackSection, double beginPosition, double endPosition) {
            this.trackSection = trackSection;
            this.beginPosition = beginPosition;
            this.endPosition = endPosition;
        }
    }
}