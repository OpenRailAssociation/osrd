package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.RJSWaypointRef;
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
        public final String route;
        @Json(name = "track_sections")
        public final List<RJSDirectionalTrackRange> trackSections;
        @Json(name = "signaling_type")
        public final String signalingType;

        /** Constructor */
        public RJSRoutePath(String route, List<RJSDirectionalTrackRange> trackSections, String signalingType) {
            this.route = route;
            this.trackSections = trackSections;
            this.signalingType = signalingType;
        }
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static class RJSDirectionalTrackRange {
        public final String track;
        private final double begin;
        private final double end;
        public final EdgeDirection direction;

        /** RailJSON Directional Track Range constructor */
        public RJSDirectionalTrackRange(String track, double begin, double end, EdgeDirection direction) {
            this.track = track;
            this.begin = begin;
            this.end = end;
            this.direction = direction;
        }

        /** Return the begin offset of the track range
         *  This function takes into account the direction so the value can be greater than getEnd()
         */
        public double getBegin() {
            if (direction == EdgeDirection.START_TO_STOP)
                return begin;
            return end;
        }

        /** Return the end offset of the track range
         *  This function takes into account the direction so the value can be smaller than getBegin()
         */
        public double getEnd() {
            if (direction == EdgeDirection.START_TO_STOP)
                return end;
            return begin;
        }
    }
}
