package fr.sncf.osrd.api.pathfinding;


import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.POSITION_EPSILON;

import com.google.common.collect.HashMultimap;
import com.google.common.collect.Range;
import com.google.common.collect.RangeMap;
import com.google.common.collect.TreeRangeMap;
import fr.sncf.osrd.api.pathfinding.response.*;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackSection;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.infra.implementation.tracks.undirected.TrackSectionImpl;
import fr.sncf.osrd.railjson.schema.infra.RJSRoutePath;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSDirectionalTrackRange;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.*;
import java.util.function.BiFunction;
import java.util.stream.Stream;

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
        // Compute the path length
        double pathLength = 0.;
        for (var range : path.ranges())
            pathLength += range.end() - range.start();

        var res = new PathfindingResult(pathLength);

        // Builds a mapping between routes and all user defined waypoints on the route
        var userDefinedWaypointsPerRoute = HashMultimap.<SignalingRoute, Double>create();
        for (var waypoint : path.waypoints())
            userDefinedWaypointsPerRoute.put(waypoint.edge(), waypoint.offset());

        // for each signaling route slice, find the waypoints on this slice, and merge these with user defined waypoints
        double pathOffset = 0.;
        for (var signalingRouteEdgeRange : path.ranges()) {
            // Ignore cases where the range length is 0
            if (signalingRouteEdgeRange.start() < signalingRouteEdgeRange.end())
                res.routePaths.add(makeRouteResult(signalingRouteEdgeRange));
            var waypoints = getWaypointsOnRoute(
                    signalingRouteEdgeRange,
                    userDefinedWaypointsPerRoute.get(signalingRouteEdgeRange.edge()),
                    pathOffset
            );
            for (var waypoint : waypoints)
                addStep(res, waypoint);
            pathOffset += signalingRouteEdgeRange.end() - signalingRouteEdgeRange.start();
        }

        // iterate on all the track section ranges of all routes, and build a schematic and geographic result geometry
        GeomUtils.addGeometry(res, infra);
        res.warnings = warningRecorder.warnings;

        var pathTrackRangeViews =
                path.ranges()
                        .stream()
                        .flatMap(signalingRouteEdgeRange -> signalingRouteEdgeRange.edge()
                                .getInfraRoute()
                                .getTrackRanges(signalingRouteEdgeRange.start(), signalingRouteEdgeRange.end())
                                .stream())
                        .filter(trackRangeView -> trackRangeView.track.getEdge() instanceof TrackSectionImpl)
                        .toList();
        res.curves = computeCurves(pathTrackRangeViews);
        res.slopes = computeSlopes(pathTrackRangeViews);
        return res;
    }

    /** Adds all waypoints on the route range, both suggestions (OP) and user defined waypoints */
    public static List<PathWaypointResult> getWaypointsOnRoute(
            Pathfinding.EdgeRange<SignalingRoute> routeRange,
            Set<Double> userDefinedWaypointOffsets,
            double pathOffset
    ) {
        var res = new ArrayList<PathWaypointResult>();

        // We need a mutable copy to remove elements as we find them
        var waypointsOffsetsList = new ArrayList<>(userDefinedWaypointOffsets);

        double routeOffset = 0;
        for (var routeTrackRange : routeRange.edge().getInfraRoute().getTrackRanges()) {
            if (!(routeTrackRange.track.getEdge() instanceof TrackSection trackSection))
                continue;

            if (routeOffset > routeRange.end())
                break;

            if (routeOffset + routeTrackRange.getLength() >= routeRange.start()) {
                // Truncate the range to match the part of the route we use
                var pathTrackRange = truncateTrackRange(routeTrackRange, routeOffset, routeRange);
                if (pathTrackRange != null) {
                    // List all waypoints on the track range in a tree map, with offsets from the range start as key
                    var waypoints = new ArrayList<PathWaypointResult>();

                    // Offset of the track on the path
                    var trackPathOffset = pathOffset + routeOffset - routeRange.start();

                    // Add operational points as optional waypoints
                    for (var op : pathTrackRange.getOperationalPoints()) {
                        var waypointTrackOffset = routeTrackRange.offsetOf(op.element().offset());
                        var waypointPathOffset = trackPathOffset + waypointTrackOffset;
                        waypoints.add(PathWaypointResult.suggestion(op.element(), trackSection, waypointPathOffset));
                    }

                    // Add user defined waypoints
                    var pathTrackRangeRouteOffset =
                            routeOffset + Math.abs(pathTrackRange.getStart() - routeTrackRange.getStart());
                    for (int i = 0; i < waypointsOffsetsList.size(); i++) {
                        var waypointRouteOffset = waypointsOffsetsList.get(i);
                        var trackRangeOffset = waypointRouteOffset - pathTrackRangeRouteOffset;

                        // We can have tiny differences here because we accumulate offsets in a different way
                        if (Math.abs(trackRangeOffset - pathTrackRange.getLength()) < POSITION_EPSILON)
                            trackRangeOffset = pathTrackRange.getLength();
                        if (Math.abs(trackRangeOffset) < POSITION_EPSILON)
                            trackRangeOffset = 0;

                        if (trackRangeOffset >= 0 && trackRangeOffset <= pathTrackRange.getLength()) {
                            var location = pathTrackRange.offsetLocation(trackRangeOffset);
                            var waypointPathOffset = pathOffset + waypointRouteOffset - routeRange.start();
                            waypoints.add(PathWaypointResult.userDefined(location, waypointPathOffset));
                            waypointsOffsetsList.remove(i--); // Avoids duplicates on track transitions
                        }
                    }

                    // Adds all waypoints in order
                    waypoints.sort(Comparator.comparingDouble(x -> x.pathOffset));
                    res.addAll(waypoints);
                }
            }

            routeOffset += routeTrackRange.getLength();
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
    private static RJSRoutePath makeRouteResult(
            Pathfinding.EdgeRange<SignalingRoute> element
    ) {
        var routeResult = new RJSRoutePath(
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
            routeResult.trackSections.add(new RJSDirectionalTrackRange(
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

    /**
     * Coalesce several range maps into one by shifting the N+1th range so it begins
     * at the end of the Nth one.
     *
     * <pre>
     * {[[1, 5], [5, 10]], [[0, 13]], [[1, 100]]} => [[1, 5], [5, 10], [10, 23], [24, 124]]
     * </pre>
     */
    static RangeMap<Double, Double> shiftingOffsetMergeRanges(List<RangeMap<Double, Double>> rangeMaps) {
        var offset = 0.;
        var result = TreeRangeMap.<Double, Double>create();
        for (var tsMap : rangeMaps) {
            for (var entry : tsMap.asMapOfRanges().entrySet()) {
                var range = entry.getKey();
                var shiftedRange = Range.closed(
                        offset + range.lowerEndpoint(),
                        offset + range.upperEndpoint()
                );
                result.putCoalescing(shiftedRange, entry.getValue());
            }
            var span = tsMap.span();
            offset += span.upperEndpoint() - span.lowerEndpoint();
        }
        return result;
    }

    /**
     * Generates and returns a list of points, generated by `factory` for both the lower and upper endpoint of
     * each range of `ranges`, in ascending order.
     */
    static <T> List<T> generateChartPoints(RangeMap<Double, Double> ranges, BiFunction<Double, Double, T> factory) {
        return ranges.asMapOfRanges().entrySet().stream().flatMap(entry -> Stream.of(
                factory.apply(entry.getKey().lowerEndpoint(), entry.getValue()),
                factory.apply(entry.getKey().upperEndpoint(), entry.getValue())
        )).toList();
    }

    /** Computes the graph of the curves of every TrackRangeView on path. */
    static List<CurveChartPointResult> computeCurves(List<TrackRangeView> pathTrackRangeViews) {
        var curves = pathTrackRangeViews.stream().map(TrackRangeView::getCurves).toList();
        var shiftedRangeMap = shiftingOffsetMergeRanges(curves);
        return generateChartPoints(shiftedRangeMap, CurveChartPointResult::new);
    }

    /** Computes the graph of the slopes of every TrackRangeView on path. */
    static List<SlopeChartPointResult> computeSlopes(List<TrackRangeView> pathTrackRangeViews) {
        var slopes = pathTrackRangeViews.stream().map(TrackRangeView::getSlopes).toList();
        var shiftedRangeMap = shiftingOffsetMergeRanges(slopes);
        return generateChartPoints(shiftedRangeMap, SlopeChartPointResult::new);
    }
}
