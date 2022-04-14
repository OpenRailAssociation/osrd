package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.railjson.schema.infra.RJSRoute;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import java.util.ArrayList;
import java.util.List;

public class RJSTrainPath {
    /**
     * Full train path as a list of routes
     */
    @Json(name = "route_paths")
    public final List<RJSRoutePath> routePath;

    public RJSTrainPath(List<RJSRoutePath> path) {
        this.routePath = path;
    }

    public RJSTrainPath() {
        this.routePath = new ArrayList<>();
    }

    public static class RJSRoutePath {
        public final RJSObjectRef<RJSRoute> route;
        @Json(name = "track_sections")
        public final List<RJSDirectionalTrackRange> trackSections;

        public RJSRoutePath(String route, List<RJSDirectionalTrackRange> trackSections) {
            this.route = new RJSObjectRef<>(route, "Route");
            this.trackSections = trackSections;
        }
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static class RJSDirectionalTrackRange {
        public final RJSObjectRef<RJSTrackSection> track;
        public final double begin;
        public final double end;
        public final EdgeDirection direction;

        /** RailJSON Directional Track Range constructor */
        public RJSDirectionalTrackRange(String track, double begin, double end, EdgeDirection direction) {
            this.track = new RJSObjectRef<>(track, "TrackSection");
            this.begin = begin;
            this.end = end;
            this.direction = direction;
        }
    }
}
