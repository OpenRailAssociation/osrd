package fr.sncf.osrd.api.pathfinding;


import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.POSITION_EPSILON;

import com.google.common.collect.HashMultimap;
import fr.sncf.osrd.api.pathfinding.response.DirTrackRange;
import fr.sncf.osrd.api.pathfinding.response.PathWaypointResult;
import fr.sncf.osrd.api.pathfinding.response.PathfindingResult;
import fr.sncf.osrd.api.pathfinding.response.RoutePathResult;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackSection;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.railjson.schema.common.RJSWaypointRef;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

public class PathfindingResultConverter {
    /**
     * The pathfinding algorithm produces a path in the signaling route graph.
     * This makes total sense, but also isn't enough: the caller wants to know
     * which waypoints were encountered, as well as the track section path and
     * its geometry.
     */
    public static PathfindingResult convert(
            Pathfinding.Result<SignalingRoute> path,
            SignalingInfra infra,
            DiagnosticRecorderImpl warningRecorder
    ) {
        var res = new PathfindingResult();

        // Builds a mapping between routes and all user defined waypoints on the route
        var userDefinedWaypointsPerRoute = HashMultimap.<SignalingRoute, Double>create();
        for (var waypoint : path.waypoints())
            userDefinedWaypointsPerRoute.put(waypoint.edge(), waypoint.offset());

        // for each signaling route slice, find the waypoints on this slice, and merge these with user defined waypoints
        for (var signalingRouteEdgeRange : path.ranges()) {
            if (signalingRouteEdgeRange.start() < signalingRouteEdgeRange.end())
                res.routePaths.add(makeRouteResult(signalingRouteEdgeRange));
            var waypoints = getWaypointsOnRoute(
                    signalingRouteEdgeRange,
                    userDefinedWaypointsPerRoute.get(signalingRouteEdgeRange.edge())
            );
            for (var waypoint : waypoints)
                addStep(res, waypoint);
        }

        // iterate on all the track section ranges of all routes, and build a schematic and geographic result geometry
        GeomUtils.addGeometry(res, infra);
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
                if (truncatedRange != null) {
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
            var truncateLength = routeRange.start() - offset;
            if (truncateLength > truncatedRange.getLength() + POSITION_EPSILON)
                return null;
            truncatedRange = truncatedRange.truncateBeginByLength(truncateLength);
        }
        if (offset + range.getLength() > routeRange.end()) {
            var truncateLength = offset + range.getLength() - routeRange.end();
            if (truncateLength > truncatedRange.getLength() + POSITION_EPSILON)
                return null;
            truncatedRange = truncatedRange.truncateEndByLength(truncateLength);
        }
        return truncatedRange;
    }

    /** Adds a single route to the result, including waypoints present on the route */
    private static RoutePathResult makeRouteResult(
            Pathfinding.EdgeRange<SignalingRoute> element
    ) {
        var routeResult = new RoutePathResult(
                element.edge().getInfraRoute().getID(),
                element.edge().getSignalingType()
        );
        double offset = 0;
        for (var range : element.edge().getInfraRoute().getTrackRanges()) {
            if (!(range.track.getEdge() instanceof TrackSection trackSection))
                continue;

            // Truncate the ranges to match the part of the route we use
            var truncatedRange = truncateTrackRange(range, offset, element);
            offset += range.getLength();
            if (truncatedRange == null)
                continue;

            // Add the track ranges to the result
            routeResult.trackSections.add(new DirTrackRange(
                    trackSection.getID(),
                    truncatedRange.getStart(),
                    truncatedRange.getStop()
            ));
        }
        return routeResult;
    }

    /** Adds a single waypoint to the result */
    static void addStep(PathfindingResult res, PathWaypointResult newStep) {
        var waypoints = res.pathWaypoints;
        if (waypoints.isEmpty()) {
            waypoints.add(newStep);
            return;
        }
        var lastStep = waypoints.get(waypoints.size() - 1);
        if (lastStep.isDuplicate(newStep)) {
            lastStep.merge(newStep);
            return;
        }
        waypoints.add(newStep);
    }
}
