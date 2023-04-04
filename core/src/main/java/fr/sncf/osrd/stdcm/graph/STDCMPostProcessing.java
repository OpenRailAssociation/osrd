package fr.sncf.osrd.stdcm.graph;

import com.google.common.collect.Iterables;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.stdcm.STDCMResult;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.stdcm.preprocessing.interfaces.RouteAvailabilityInterface;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.TrainStop;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

/** This class contains all the static methods used to turn the raw pathfinding result into a full response.
 * This includes creating the final envelope (merging the parts + applying the allowances) */
public class STDCMPostProcessing {

    /** Builds the STDCM result object from the raw pathfinding result.
     * This is the only non-private method of this class, the rest is implementation detail. */
    static STDCMResult makeResult(
            Pathfinding.Result<STDCMEdge> path,
            double startTime,
            AllowanceValue standardAllowance,
            RollingStock rollingStock,
            double timeStep,
            RollingStock.Comfort comfort,
            double maxRunTime,
            RouteAvailabilityInterface routeAvailability
    ) {
        var ranges = makeEdgeRange(path);
        var routeRanges = makeRouteRanges(ranges);
        var routeWaypoints = makeRouteWaypoints(path);
        var physicsPath = EnvelopeTrainPath.from(makeTrackRanges(ranges));
        var mergedEnvelopes = STDCMUtils.mergeEnvelopeRanges(ranges);
        var departureTime = computeDepartureTime(ranges, startTime);
        var stops = makeStops(ranges);
        var withAllowance = STDCMStandardAllowance.applyAllowance(
                mergedEnvelopes,
                ranges,
                standardAllowance,
                physicsPath,
                rollingStock,
                timeStep,
                comfort,
                routeAvailability,
                departureTime,
                stops
        );
        var res = new STDCMResult(
                new Pathfinding.Result<>(routeRanges, routeWaypoints),
                withAllowance,
                makeTrainPath(ranges),
                physicsPath,
                departureTime,
                stops
        );
        if (res.envelope().getTotalTime() > maxRunTime) {
            // This can happen if the destination is one edge away from being reachable in time,
            // as we only check the time at the start of an edge when exploring the graph
            return null;
        }
        return res;
    }

    /** Creates the list of waypoints on the path */
    private static List<Pathfinding.EdgeLocation<SignalingRoute>> makeRouteWaypoints(
            Pathfinding.Result<STDCMEdge> path
    ) {
        var res = new ArrayList<Pathfinding.EdgeLocation<SignalingRoute>>();
        for (var waypoint : path.waypoints()) {
            var routeOffset = waypoint.offset() + waypoint.edge().envelopeStartOffset();
            res.add(new Pathfinding.EdgeLocation<>(waypoint.edge().route(), routeOffset));
        }
        return res;
    }

    /** Builds the list of route ranges, merging the ranges on the same route */
    private static List<Pathfinding.EdgeRange<SignalingRoute>> makeRouteRanges(
            List<Pathfinding.EdgeRange<STDCMEdge>> ranges
    ) {
        var res = new ArrayList<Pathfinding.EdgeRange<SignalingRoute>>();
        int i = 0;
        while (i < ranges.size()) {
            var range = ranges.get(i);
            double start = range.start() + range.edge().envelopeStartOffset();
            double length = range.end() - range.start();
            while (i + 1 < ranges.size()) {
                var nextRange = ranges.get(i + 1);
                if (!range.edge().route().equals(nextRange.edge().route()))
                    break;
                length += nextRange.end() - nextRange.start();
                i++;
            }
            res.add(new Pathfinding.EdgeRange<>(range.edge().route(), start, start + length));
            i++;
        }
        return res;
    }

    /** Builds the actual list of EdgeRange given the raw result of the pathfinding.
     * We can't use the pathfinding result directly because we use our own method
     * to keep track of previous nodes/edges. */
    private static List<Pathfinding.EdgeRange<STDCMEdge>> makeEdgeRange(
            Pathfinding.Result<STDCMEdge> raw
    ) {
        var orderedEdges = new ArrayDeque<STDCMEdge>();
        var firstRange = raw.ranges().get(0);
        var lastRange = raw.ranges().get(raw.ranges().size() - 1);
        var current = lastRange.edge();
        while (true) {
            orderedEdges.addFirst(current);
            if (current.previousNode() == null)
                break;
            current = current.previousNode().previousEdge();
        }
        firstRange = new Pathfinding.EdgeRange<>(orderedEdges.removeFirst(), firstRange.start(), firstRange.end());
        if (lastRange.edge() != firstRange.edge())
            lastRange = new Pathfinding.EdgeRange<>(orderedEdges.removeLast(), lastRange.start(), lastRange.end());
        var res = new ArrayList<Pathfinding.EdgeRange<STDCMEdge>>();
        res.add(firstRange);
        for (var edge : orderedEdges)
            res.add(new Pathfinding.EdgeRange<>(edge, 0, edge.getLength()));
        if (firstRange.edge() != lastRange.edge())
            res.add(lastRange);
        return res;
    }

    /** Converts the list of pathfinding edges into a list of TrackRangeView that covers the path exactly */
    private static List<TrackRangeView> makeTrackRanges(
            List<Pathfinding.EdgeRange<STDCMEdge>> edges
    ) {
        var trackRanges = new ArrayList<TrackRangeView>();
        for (var routeRange : edges) {
            var infraRoute = routeRange.edge().route().getInfraRoute();
            var startOffset = routeRange.edge().envelopeStartOffset();
            trackRanges.addAll(infraRoute.getTrackRanges(
                    startOffset + routeRange.start(),
                    startOffset + routeRange.end())
            );
        }
        return trackRanges;
    }

    /** Creates a TrainPath instance from the list of pathfinding edges */
    static TrainPath makeTrainPath(
            List<Pathfinding.EdgeRange<STDCMEdge>> ranges
    ) {
        var routeList = new ArrayList<SignalingRoute>();
        for (var range : ranges) {
            if (routeList.isEmpty() || !Iterables.getLast(routeList).equals(range.edge().route()))
                routeList.add(range.edge().route());
        }
        var trackRanges = makeTrackRanges(ranges);
        var lastRange = trackRanges.get(trackRanges.size() - 1);
        return TrainPathBuilder.from(
                routeList,
                trackRanges.get(0).offsetLocation(0),
                lastRange.offsetLocation(lastRange.getLength())
        );
    }

    /** Computes the departure time, made of the sum of all delays added over the path */
    static double computeDepartureTime(List<Pathfinding.EdgeRange<STDCMEdge>> ranges, double startTime) {
        for (var range : ranges)
            startTime += range.edge().addedDelay();
        return startTime;
    }

    /** Builds the list of stops from the ranges */
    private static List<TrainStop> makeStops(List<Pathfinding.EdgeRange<STDCMEdge>> ranges) {
        var res = new ArrayList<TrainStop>();
        double offset = 0;
        for (var range : ranges) {
            var prevNode = range.edge().previousNode();
            if (prevNode != null && prevNode.stopDuration() >= 0 && range.start() == 0)
                res.add(new TrainStop(offset, prevNode.stopDuration()));
            offset += range.end() - range.start();
        }
        return res;
    }
}
