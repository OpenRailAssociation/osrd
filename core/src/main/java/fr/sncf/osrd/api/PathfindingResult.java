package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.new_infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.new_infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.new_infra.api.tracks.undirected.OperationalPoint;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackSection;
import fr.sncf.osrd.new_infra.implementation.RJSObjectParsing;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSRoute;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.utils.geom.LineString;
import fr.sncf.osrd.utils.new_graph.Pathfinding;
import java.util.ArrayList;
import java.util.List;

public class PathfindingResult {
    @Json(name = "route_paths")
    public final List<RoutePathResult> routePaths = new ArrayList<>();
    @Json(name = "path_waypoints")
    public final List<PathWaypointResult> pathWaypoints = new ArrayList<>();

    public LineString geographic = null;
    public LineString schematic = null;

    /**
     * pathfindingResultMake is used to create a class PathfindingResult with a good format to be sent to the middleware
     * during this function, we add geometric information in the PathfindingResult
     * @param path contains the pathfinding's result
     */
    public static PathfindingResult make(
            ArrayList<Pathfinding.EdgeRange<SignalingRoute>> path,
            SignalingInfra infra
    ) {
        var res = new PathfindingResult();
        for (var signalingRouteEdgeRange : path)
            res.routePaths.add(
                    makeRouteResult(
                            res,
                            signalingRouteEdgeRange
                    )
            );
        var lastRoute = res.routePaths.get(res.routePaths.size() - 1);
        var lastRange = lastRoute.trackSections.get(lastRoute.trackSections.size() - 1);
        res.addStep(new PathWaypointResult(lastRange.trackSection.id.id, lastRange.end));
        res.addGeometry(infra);
        return res;
    }

    /** Adds a single route to the result, including waypoints present on the route */
    private static RoutePathResult makeRouteResult(
            PathfindingResult pathfindingResult,
            Pathfinding.EdgeRange<SignalingRoute> element
    ) {
        var routeResult = new RoutePathResult(new RJSObjectRef<>(element.edge().getInfraRoute().getID(), "Route"));
        double offset = 0;
        for (var range : element.edge().getInfraRoute().getTrackRanges()) {
            if (!(range.track.getEdge() instanceof TrackSection trackSection))
                continue;

            // Truncate the ranges to match the part of the route we use
            var truncatedRange = range;
            if (offset < element.start()) {
                truncatedRange = truncatedRange.truncateBeginByLength(element.start() - offset);
            }
            if (offset + range.getLength() > element.end()) {
                truncatedRange = truncatedRange.truncateEndByLength(offset + range.getLength() - element.end());
            }
            offset += range.getLength();
            if (truncatedRange.getLength() == 0)
                continue;

            // Add the track ranges to the result
            routeResult.trackSections.add(new PathfindingEndpoint.DirectionalTrackRangeResult(
                    trackSection.getID(),
                    truncatedRange.getStart(),
                    truncatedRange.getStop()
            ));
            if (pathfindingResult.pathWaypoints.isEmpty()) {
                // add the first waypoint
                var firstLocation = truncatedRange.offsetLocation(0);
                pathfindingResult.addStep(
                        new PathWaypointResult(firstLocation.track().getID(), firstLocation.offset())
                );
            }

            // Add waypoints: OP as suggestions, and start / end locations
            for (var op : truncatedRange.getOperationalPoints())
                pathfindingResult.addStep(new PathWaypointResult(op.element(), trackSection));
        }
        return routeResult;
    }

    /** Adds a single waypoint to the result */
    void addStep(PathWaypointResult newStep) {
        if (pathWaypoints.isEmpty()) {
            pathWaypoints.add(newStep);
            return;
        }
        var lastStep = pathWaypoints.get(pathWaypoints.size() - 1);
        if (lastStep.isDuplicate(newStep)) {
            lastStep.merge(newStep);
            return;
        }
        pathWaypoints.add(newStep);
    }

    /** Generates the path geometry */
    void addGeometry(SignalingInfra infra) {
        var geoList = new ArrayList<LineString>();
        var schList = new ArrayList<LineString>();

        PathfindingEndpoint.DirectionalTrackRangeResult previousTrack = null;
        double previousBegin = 0;
        double previousEnd = 0;

        for (var routePath : routePaths) {
            for (var trackSection : routePath.trackSections) {

                if (previousTrack == null) {
                    previousTrack = trackSection;
                    previousBegin = trackSection.begin;
                    previousEnd = trackSection.end;
                    continue;
                }

                if (previousTrack.trackSection.id.id.compareTo(trackSection.trackSection.id.id) != 0) {
                    if (Double.compare(previousBegin, previousEnd) != 0) {
                        var track = RJSObjectParsing.getTrackSection(previousTrack.trackSection, infra);
                        sliceAndAdd(geoList, track.getGeo(), previousBegin, previousEnd, track.getLength());
                        sliceAndAdd(schList, track.getSch(), previousBegin, previousEnd, track.getLength());
                    }
                    previousTrack = trackSection;
                    previousBegin = trackSection.begin;
                }
                previousEnd = trackSection.end;
            }
        }

        assert previousTrack != null;
        var track = RJSObjectParsing.getTrackSection(previousTrack.trackSection, infra);
        sliceAndAdd(geoList, track.getGeo(), previousBegin, previousEnd, track.getLength());
        sliceAndAdd(schList, track.getSch(), previousBegin, previousEnd, track.getLength());

        geographic = concatenate(geoList);
        schematic = concatenate(schList);
    }

    /** Concatenates a list of LineString into a single LineString.
     * If not enough values are present, we return the default [0, 1] line. */
    private LineString concatenate(List<LineString> list) {
        if (list.size() >= 2)
            return LineString.concatenate(list);
        else if (list.size() == 1)
            return list.get(0);
        else
            return LineString.make(
                    new double[] {0., 1.},
                    new double[] {0., 1.}
            );
    }

    /** If the lineString isn't null, slice it from previousBegin to previousEnd and add it to res */
    private static void sliceAndAdd(
            List<LineString> res,
            LineString lineString,
            double previousBegin,
            double previousEnd,
            double trackLength
    ) {
        if (lineString == null)
            return;
        if (trackLength == 0) {
            assert previousBegin == 0;
            assert previousEnd == 0;
            res.add(lineString);
        } else
            res.add(lineString.slice(previousBegin / trackLength, previousEnd / trackLength));
    }

    /** A single route on the path */
    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static class RoutePathResult {
        public final RJSObjectRef<RJSRoute> route;
        @Json(name = "track_sections")
        public final List<PathfindingEndpoint.DirectionalTrackRangeResult> trackSections = new ArrayList<>();

        public RoutePathResult(RJSObjectRef<RJSRoute> route) {
            this.route = route;
        }
    }

    /** One waypoint in the path, represents an operational point */
    public static class PathWaypointResult {
        /** ID if the operational point */
        public String id;
        /** A point is a suggestion if it's not part of the input path and just an OP on the path */
        public boolean suggestion;
        /** Track the point is on */
        public RJSObjectRef<RJSTrackSection> track;
        /** Offset of the point */
        public double position;

        /** Suggested operational points */
        PathWaypointResult(OperationalPoint op, TrackSection trackSection) {
            this.id = op.id();
            this.suggestion = true;
            this.track = new RJSObjectRef<>(trackSection.getID(), "TrackSection");
            this.position = op.offset();
        }

        /** Given step */
        public PathWaypointResult(String id, double offset) {
            this.suggestion = false;
            this.track = new RJSObjectRef<>(id, "TrackSection");
            this.position = offset;
        }

        /** Check if two steps result are at the same location */
        public boolean isDuplicate(PathWaypointResult other) {
            if (!track.equals(other.track))
                return false;
            return Math.abs(position - other.position) < 0.001;
        }

        /** Merge a suggested with a give step */
        public void merge(PathWaypointResult other) {
            suggestion &= other.suggestion;
            if (!other.suggestion)
                return;
            position = other.position;
            id = other.id;
        }
    }
}

