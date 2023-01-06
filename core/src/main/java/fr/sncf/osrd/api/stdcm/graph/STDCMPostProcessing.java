package fr.sncf.osrd.api.stdcm.graph;

import fr.sncf.osrd.api.stdcm.STDCMResult;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.PhysicsPath;
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;
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
            double maxRunTime
    ) {
        var ranges = makeEdgeRange(path);
        var routeRanges = ranges.stream()
                .map(x -> new Pathfinding.EdgeRange<>(x.edge().route(), x.start(), x.end()))
                .toList();
        var routeWaypoints = path.waypoints().stream()
                .map(x -> new Pathfinding.EdgeLocation<>(x.edge().route(), x.offset()))
                .toList();
        var physicsPath = EnvelopeTrainPath.from(makeTrackRanges(ranges));
        var mergedEnvelopes = STDCMUtils.mergeEnvelopeRanges(ranges);
        var withAllowance = applyAllowance(
                mergedEnvelopes,
                ranges,
                standardAllowance,
                physicsPath,
                rollingStock,
                timeStep,
                comfort
        );
        var res = new STDCMResult(
                new Pathfinding.Result<>(routeRanges, routeWaypoints),
                withAllowance,
                makeTrainPath(ranges),
                physicsPath,
                computeDepartureTime(ranges, startTime)
        );
        if (res.envelope().getTotalTime() > maxRunTime) {
            // This can happen if the destination is one edge away from being reachable in time,
            // as we only check the time at the start of an edge when exploring the graph
            return null;
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
            res.add(new Pathfinding.EdgeRange<>(edge, 0, edge.route().getInfraRoute().getLength()));
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
            trackRanges.addAll(infraRoute.getTrackRanges(routeRange.start(), routeRange.end()));
        }
        return trackRanges;
    }

    /** Applies the allowance to the final envelope */
    private static Envelope applyAllowance(
            Envelope envelope,
            List<Pathfinding.EdgeRange<STDCMEdge>> ranges,
            AllowanceValue standardAllowance,
            PhysicsPath physicsPath,
            RollingStock rollingStock,
            double timeStep,
            RollingStock.Comfort comfort
    ) {
        if (standardAllowance == null)
            return envelope; // This isn't just an optimization, it avoids float inaccuracies
        var allowance = new LinearAllowance(
                new EnvelopeSimContext(rollingStock, physicsPath, timeStep, comfort),
                0,
                envelope.getEndPos(),
                1,
                makeAllowanceRanges(standardAllowance, ranges)
        );
        return allowance.apply(envelope);
    }

    /** Creates the list of allowance ranges for the final standard allowance.
     * Adjacent ranges with identical values are merged to avoid extra binary search and an accumulation of errors. */
    private static List<AllowanceRange> makeAllowanceRanges(
            AllowanceValue allowance,
            List<Pathfinding.EdgeRange<STDCMEdge>> ranges
    ) {
        double prevPosition = 0;
        var allowanceRanges = new ArrayList<AllowanceRange>();
        double prevAllowanceRatio = Double.NaN;
        for (var range : ranges) {
            if (range.start() == range.end())
                continue;
            var currentAllowanceRatio = allowance.getAllowanceRatio(
                    range.edge().envelope().getTotalTime(),
                    range.end() - range.start()
            );
            var endPosition = prevPosition + range.end() - range.start();
            if (prevAllowanceRatio == currentAllowanceRatio) {
                // Merge with the previous range
                allowanceRanges.set(allowanceRanges.size() - 1, new AllowanceRange(
                        allowanceRanges.get(allowanceRanges.size() - 1).beginPos,
                        endPosition,
                        allowance
                ));
            } else {
                prevAllowanceRatio = currentAllowanceRatio;
                allowanceRanges.add(new AllowanceRange(prevPosition, endPosition, allowance));
            }
            prevPosition = endPosition;
        }
        return allowanceRanges;
    }

    /** Creates a TrainPath instance from the list of pathfinding edges */
    static TrainPath makeTrainPath(
            List<Pathfinding.EdgeRange<STDCMEdge>> ranges
    ) {
        var routeList = ranges.stream()
                .map(edge -> edge.edge().route())
                .toList();
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
}
