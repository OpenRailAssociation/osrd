package fr.sncf.osrd.stdcm.graph;

import static fr.sncf.osrd.sim_infra.api.PathPropertiesKt.makePathProperties;
import static fr.sncf.osrd.utils.units.Distance.toMeters;

import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.stdcm.STDCMResult;
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.TrainStop;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

/** This class contains all the static methods used to turn the raw pathfinding result into a full response.
 * This includes creating the final envelope (merging the parts + applying the allowances) */
public class STDCMPostProcessing {

    private final STDCMGraph graph;

    public STDCMPostProcessing(STDCMGraph graph) {
        this.graph = graph;
    }

    /** Builds the STDCM result object from the raw pathfinding result.
     * This is the only non-private method of this class, the rest is implementation detail. */
    STDCMResult makeResult(
            RawSignalingInfra infra,
            Pathfinding.Result<STDCMEdge> path,
            double startTime,
            AllowanceValue performanceAllowance,
            RollingStock rollingStock,
            double timeStep,
            RollingStock.Comfort comfort,
            double maxRunTime,
            BlockAvailabilityInterface blockAvailability
    ) {
        var ranges = makeEdgeRange(path);
        var blockRanges = makeBlockRanges(ranges);
        var blockWaypoints = makeBlockWaypoints(path);
        var chunkPath = STDCMUtils.makeChunkPathFromRanges(graph, ranges);
        var trainPath = makePathProperties(infra, chunkPath);
        var physicsPath = EnvelopeTrainPath.from(infra, trainPath);
        var mergedEnvelopes = STDCMUtils.mergeEnvelopeRanges(ranges);
        var departureTime = computeDepartureTime(ranges, startTime);
        var stops = makeStops(ranges);
        var withAllowance = STDCMPerformanceAllowance.applyAllowance(
                graph,
                mergedEnvelopes,
                ranges,
                performanceAllowance,
                physicsPath,
                rollingStock,
                timeStep,
                comfort,
                blockAvailability,
                departureTime,
                stops
        );
        var res = new STDCMResult(
                new Pathfinding.Result<>(blockRanges, blockWaypoints),
                withAllowance,
                trainPath,
                chunkPath,
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
    private static List<Pathfinding.EdgeLocation<Integer>> makeBlockWaypoints(
            Pathfinding.Result<STDCMEdge> path
    ) {
        var res = new ArrayList<Pathfinding.EdgeLocation<Integer>>();
        for (var waypoint : path.waypoints()) {
            var blockOffset = waypoint.offset() + waypoint.edge().envelopeStartOffset();
            res.add(new Pathfinding.EdgeLocation<>(waypoint.edge().block(), blockOffset));
        }
        return res;
    }

    /** Builds the list of block ranges, merging the ranges on the same block */
    private List<Pathfinding.EdgeRange<Integer>> makeBlockRanges(
            List<Pathfinding.EdgeRange<STDCMEdge>> ranges
    ) {
        var res = new ArrayList<Pathfinding.EdgeRange<Integer>>();
        int i = 0;
        while (i < ranges.size()) {
            var range = ranges.get(i);
            long start = range.start() + range.edge().envelopeStartOffset();
            long length = range.end() - range.start();
            while (i + 1 < ranges.size()) {
                var nextRange = ranges.get(i + 1);
                if (range.edge().block() != nextRange.edge().block())
                    break;
                length += nextRange.end() - nextRange.start();
                i++;
            }
            var end = start + length;
            res.add(new Pathfinding.EdgeRange<>(range.edge().block(), start, end));
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

    /** Computes the departure time, made of the sum of all delays added over the path */
    static double computeDepartureTime(List<Pathfinding.EdgeRange<STDCMEdge>> ranges, double startTime) {
        for (var range : ranges)
            startTime += range.edge().addedDelay();
        return startTime;
    }

    /** Builds the list of stops from the ranges */
    private static List<TrainStop> makeStops(List<Pathfinding.EdgeRange<STDCMEdge>> ranges) {
        var res = new ArrayList<TrainStop>();
        long offset = 0;
        for (var range : ranges) {
            var prevNode = range.edge().previousNode();
            if (prevNode != null && prevNode.stopDuration() >= 0 && range.start() == 0)
                res.add(new TrainStop(toMeters(offset), prevNode.stopDuration()));
            offset += range.end() - range.start();
        }
        return res;
    }
}
