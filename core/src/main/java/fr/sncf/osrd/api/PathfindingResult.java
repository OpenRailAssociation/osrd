package fr.sncf.osrd.api;

import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.POSITION_EPSILON;

import com.google.common.collect.HashMultimap;
import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.api.tracks.undirected.OperationalPoint;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackSection;
import fr.sncf.osrd.infra.implementation.RJSObjectParsing;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSRoute;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.reporting.warnings.Warning;
import fr.sncf.osrd.reporting.warnings.WarningRecorderImpl;
import fr.sncf.osrd.utils.geom.LineString;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.*;

public class PathfindingResult {
    @Json(name = "route_paths")
    public final List<RoutePathResult> routePaths = new ArrayList<>();
    @Json(name = "path_waypoints")
    public final List<PathWaypointResult> pathWaypoints = new ArrayList<>();
    public List<Warning> warnings;

    public LineString geographic = null;
    public LineString schematic = null;

    /**
     * pathfindingResultMake is used to create a class PathfindingResult with a good format to be sent to the middleware
     * during this function, we add geometric information in the PathfindingResult
     *
     * @param path contains the pathfinding's result
     */
    public static PathfindingResult make(
            Pathfinding.Result<SignalingRoute> path,
            SignalingInfra infra,
            WarningRecorderImpl warningRecorder
    ) {
        var res = new PathfindingResult();

        // Builds a mapping between routes and all user defined waypoints on the route
        var userDefinedWaypointsPerRoute = HashMultimap.<SignalingRoute, Double>create();
        for (var waypoint : path.waypoints())
            userDefinedWaypointsPerRoute.put(waypoint.edge(), waypoint.offset());

        for (var signalingRouteEdgeRange : path.ranges()) {
            if (signalingRouteEdgeRange.start() < signalingRouteEdgeRange.end())
                res.routePaths.add(makeRouteResult(signalingRouteEdgeRange));
            var waypoints = getWaypointsOnRoute(
                    signalingRouteEdgeRange,
                    userDefinedWaypointsPerRoute.get(signalingRouteEdgeRange.edge())
            );
            for (var waypoint : waypoints)
                res.addStep(waypoint);
        }
        res.addGeometry(infra);
        res.warnings = warningRecorder.warnings;
        return res;
    }

    /** Adds all waypoints on the route range, both suggestions (OP) and user defined waypoints */
    public static List<PathWaypointResult> getWaypointsOnRoute(
            Pathfinding.EdgeRange<SignalingRoute> routeRange,
            Set<Double> userDefinedWaypointOffsets
    ) {
        var res = new ArrayList<PathWaypointResult>();

        // We need a mutable copy to remove elements as we find them
        var waypointsOffsetsList = new ArrayList<>(userDefinedWaypointOffsets);

        double offset = 0;
        for (var range : routeRange.edge().getInfraRoute().getTrackRanges()) {
            if (!(range.track.getEdge() instanceof TrackSection trackSection))
                continue;

            if (offset > routeRange.end())
                break;

            if (offset + range.getLength() >= routeRange.start()) {
                // Truncate the range to match the part of the route we use
                var truncatedRange = truncateTrackRange(range, offset, routeRange);

                // List all waypoints on the track range in a tree map, with offsets from the range start as key
                var waypoints = new ArrayList<PathWaypointResult>();

                // Add operational points as optional waypoints
                for (var op : truncatedRange.getOperationalPoints())
                    waypoints.add(PathWaypointResult.suggestion(op.element(), trackSection, op.offset()));

                // Add user defined waypoints
                var truncatedRangeOffset = offset + Math.abs(truncatedRange.getStart() - range.getStart());
                for (int i = 0; i < waypointsOffsetsList.size(); i++) {
                    var trackRangeOffset = waypointsOffsetsList.get(i) - truncatedRangeOffset;

                    // We can have tiny differences here because we accumulate offsets in a different way
                    if (Math.abs(trackRangeOffset - truncatedRange.getLength()) < POSITION_EPSILON)
                        trackRangeOffset = truncatedRange.getLength();
                    if (Math.abs(trackRangeOffset) < POSITION_EPSILON)
                        trackRangeOffset = 0;

                    if (trackRangeOffset >= 0 && trackRangeOffset <= truncatedRange.getLength()) {
                        var location = truncatedRange.offsetLocation(trackRangeOffset);
                        waypoints.add(PathWaypointResult.userDefined(location, trackRangeOffset));
                        waypointsOffsetsList.remove(i--); // Avoids duplicates on track transitions
                    }
                }

                // Adds all waypoints in order
                waypoints.sort(Comparator.comparingDouble(x -> x.trackRangeOffset));
                res.addAll(waypoints);
            }

            offset += range.getLength();
        }
        assert waypointsOffsetsList.isEmpty();
        return res;
    }

    /** Truncates a track range view so that it's limited to the route range */
    private static TrackRangeView truncateTrackRange(
            TrackRangeView range,
            double offset,
            Pathfinding.EdgeRange<SignalingRoute> routeRange
    ) {
        var truncatedRange = range;
        if (offset < routeRange.start()) {
            truncatedRange = truncatedRange.truncateBeginByLength(routeRange.start() - offset);
        }
        if (offset + range.getLength() > routeRange.end()) {
            truncatedRange = truncatedRange.truncateEndByLength(offset + range.getLength() - routeRange.end());
        }
        return truncatedRange;
    }

    /** Adds a single route to the result, including waypoints present on the route */
    private static RoutePathResult makeRouteResult(
            Pathfinding.EdgeRange<SignalingRoute> element
    ) {
        var routeResult = new RoutePathResult(
                new RJSObjectRef<>(element.edge().getInfraRoute().getID(), "Route"),
                element.edge().getSignalingType()
        );
        double offset = 0;
        for (var range : element.edge().getInfraRoute().getTrackRanges()) {
            if (!(range.track.getEdge() instanceof TrackSection trackSection))
                continue;

            // Truncate the ranges to match the part of the route we use
            var truncatedRange = truncateTrackRange(range, offset, element);
            offset += range.getLength();
            if (truncatedRange.getLength() == 0)
                continue;

            // Add the track ranges to the result
            routeResult.trackSections.add(new PathfindingEndpoint.DirectionalTrackRangeResult(
                    trackSection.getID(),
                    truncatedRange.getStart(),
                    truncatedRange.getStop()
            ));
        }
        return routeResult;
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
                    previousBegin = trackSection.getBegin();
                    previousEnd = trackSection.getEnd();
                    continue;
                }

                if (previousTrack.trackSection.id.id.compareTo(trackSection.trackSection.id.id) != 0) {
                    if (Double.compare(previousBegin, previousEnd) != 0) {
                        var track = RJSObjectParsing.getTrackSection(previousTrack.trackSection, infra);
                        sliceAndAdd(geoList, track.getGeo(), previousBegin, previousEnd, track.getLength());
                        sliceAndAdd(schList, track.getSch(), previousBegin, previousEnd, track.getLength());
                    }
                    previousTrack = trackSection;
                    previousBegin = trackSection.getBegin();
                }
                previousEnd = trackSection.getEnd();
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

    /** A single route on the path */
    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static class RoutePathResult {
        public final RJSObjectRef<RJSRoute> route;
        @Json(name = "track_sections")
        public final List<PathfindingEndpoint.DirectionalTrackRangeResult> trackSections = new ArrayList<>();
        @Json(name = "signaling_type")
        public final String signalingType;

        public RoutePathResult(RJSObjectRef<RJSRoute> route, String signalingType) {
            this.route = route;
            this.signalingType = signalingType;
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
        /** Offset of the point on the track */
        public double position;
        /** Used to sort the waypoint, not a part of the actual response (transient) */
        private final transient double trackRangeOffset;

        /** Constructor */
        private PathWaypointResult(
                String trackID,
                double offset,
                boolean suggestion,
                String opID,
                double trackRangeOffset
        ) {
            this.suggestion = suggestion;
            this.track = new RJSObjectRef<>(trackID, "TrackSection");
            this.position = offset;
            this.id = opID;
            this.trackRangeOffset = trackRangeOffset;
        }

        /** Creates a suggested waypoint from an OP */
        public static PathWaypointResult suggestion(
                OperationalPoint op, TrackSection trackSection, double trackRangeOffset
        ) {
            return new PathWaypointResult(trackSection.getID(), op.offset(), true, op.id(), trackRangeOffset);
        }

        /** Creates a user defined waypoint */
        public static PathWaypointResult userDefined(TrackLocation location, double trackRangeOffset) {
            return new PathWaypointResult(location.track().getID(), location.offset(), false, null, trackRangeOffset);
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

