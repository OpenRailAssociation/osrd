package fr.sncf.osrd.api.stdcm.graph;

import com.google.common.collect.Multimap;
import fr.sncf.osrd.api.pathfinding.RemainingDistanceEstimator;
import fr.sncf.osrd.api.stdcm.OccupancyBlock;
import fr.sncf.osrd.api.stdcm.STDCMResult;
import fr.sncf.osrd.api.pathfinding.constraints.ElectrificationConstraints;
import fr.sncf.osrd.api.pathfinding.constraints.LoadingGaugeConstraints;
import fr.sncf.osrd.envelope_sim.PhysicsPath;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeRange;
import fr.sncf.osrd.utils.graph.functional_interfaces.TargetsOnEdge;
import fr.sncf.osrd.utils.graph.functional_interfaces.AStarHeuristic;
import java.util.*;


/** This class combines all the (static) methods used to find a path in the STDCM graph. */
public class STDCMPathfinding {

    /** Given an infra, a rolling stock and a collection of unavailable time for each route,
     * find a path made of a sequence of route ranges with a matching envelope.
     * Returns null if no path is found.
     * */
    public static STDCMResult findPath(
            SignalingInfra infra,
            RollingStock rollingStock,
            double startTime,
            double endTime,
            Set<Pathfinding.EdgeLocation<SignalingRoute>> startLocations,
            Set<Pathfinding.EdgeLocation<SignalingRoute>> endLocations,
            Multimap<SignalingRoute, OccupancyBlock> unavailableTimes,
            double timeStep,
            double maxDepartureDelay,
            double maxRunTime
    ) {
        var graph = new STDCMGraph(
                infra,
                rollingStock,
                timeStep,
                unavailableTimes,
                maxRunTime,
                startTime,
                endLocations
        );

        // Initializes the constraints
        var loadingGaugeConstraints = new LoadingGaugeConstraints(List.of(rollingStock));
        var electrificationConstraints = new ElectrificationConstraints(List.of(rollingStock));

        var path = new Pathfinding<>(graph)
                .setEdgeToLength(edge -> edge.route().getInfraRoute().getLength())
                .setRemainingDistanceEstimator(makeAStarHeuristic(endLocations, rollingStock))
                .addBlockedRangeOnEdges(edge -> loadingGaugeConstraints.apply(edge.route()))
                .addBlockedRangeOnEdges(edge -> electrificationConstraints.apply(edge.route()))
                .setEdgeRangeCost(STDCMPathfinding::edgeRangeCost)
                .runPathfinding(
                        convertLocations(graph, startLocations, startTime, maxDepartureDelay),
                        makeObjectiveFunction(endLocations, graph)
                );
        if (path == null)
            return null;
        var res = makeResult(path, startTime);
        if (res.envelope().getTotalTime() > maxRunTime) {
            // This can happen if the destination is one edge away from being reachable in time,
            // as we only check the time at the start of an edge when exploring the graph
            return null;
        }
        return res;
    }

    /** Make the objective function from the edge locations */
    private static List<TargetsOnEdge<STDCMEdge>> makeObjectiveFunction(
            Set<Pathfinding.EdgeLocation<SignalingRoute>> endLocations,
            STDCMGraph graph
    ) {
        return List.of(edge -> {
            var res = new HashSet<Pathfinding.EdgeLocation<STDCMEdge>>();
            edge = edge.finishBuildingEdge(graph);
            if (edge == null)
                return res;
            for (var loc : endLocations)
                if (loc.edge().equals(edge.route()))
                    res.add(new Pathfinding.EdgeLocation<>(edge, loc.offset()));
            return res;
        });
    }

    private static double edgeRangeCost(EdgeRange<STDCMEdge> range) {
        var envelope = range.edge().envelope();
        var timeStart = STDCMUtils.interpolateTime(envelope, range.edge().route(), range.start(), 0);
        var timeEnd = STDCMUtils.interpolateTime(envelope, range.edge().route(), range.end(), 0);
        return timeEnd - timeStart + range.edge().addedDelay();
    }

    private static AStarHeuristic<STDCMEdge> makeAStarHeuristic(
            Set<Pathfinding.EdgeLocation<SignalingRoute>> endLocations,
            RollingStock rollingStock
    ) {
        var remainingDistance = new RemainingDistanceEstimator(endLocations);
        return ((edge, offset) -> {
            var distance = remainingDistance.apply(edge.route(), offset);
            return distance / rollingStock.maxSpeed;
        });
    }

    /** Builds the actual list of EdgeRange given the raw result of the pathfinding.
     * We can't use it directly because it can't handle backtracking properly */
    private static List<EdgeRange<STDCMEdge>> makeEdgeRange(
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
        firstRange = new EdgeRange<>(orderedEdges.removeFirst(), firstRange.start(), firstRange.end());
        if (lastRange.edge() != firstRange.edge())
            lastRange = new EdgeRange<>(orderedEdges.removeLast(), lastRange.start(), lastRange.end());
        var res = new ArrayList<EdgeRange<STDCMEdge>>();
        res.add(firstRange);
        for (var edge : orderedEdges)
            res.add(new EdgeRange<>(edge, 0, edge.route().getInfraRoute().getLength()));
        if (firstRange != lastRange)
            res.add(lastRange);
        return res;
    }

    /** Builds the STDCM result object from the raw pathfinding result */
    private static STDCMResult makeResult(
            Pathfinding.Result<STDCMEdge> path,
            double startTime
    ) {
        var ranges = makeEdgeRange(path);
        var routeRanges = ranges.stream()
                .map(x -> new EdgeRange<>(x.edge().route(), x.start(), x.end()))
                .toList();
        var routeWaypoints = path.waypoints().stream()
                .map(x -> new Pathfinding.EdgeLocation<>(x.edge().route(), x.offset()))
                .toList();
        var physicsPath = makePhysicsPath(ranges);
        return new STDCMResult(
                new Pathfinding.Result<>(routeRanges, routeWaypoints),
                STDCMUtils.mergeEnvelopeRanges(ranges),
                makeTrainPath(ranges),
                physicsPath,
                computeDepartureTime(ranges, startTime)
        );
    }

    /** Converts the list of pathfinding edges into a list of TrackRangeView that covers the path exactly */
    private static List<TrackRangeView> makeTrackRanges(
            List<EdgeRange<STDCMEdge>> edges
    ) {
        var trackRanges = new ArrayList<TrackRangeView>();
        for (var routeRange : edges) {
            var infraRoute = routeRange.edge().route().getInfraRoute();
            trackRanges.addAll(infraRoute.getTrackRanges(routeRange.start(), routeRange.end()));
        }
        return trackRanges;
    }

    /** Builds a PhysicsPath from the pathfinding edges */
    private static PhysicsPath makePhysicsPath(
            List<EdgeRange<STDCMEdge>> edges
    ) {
        return EnvelopeTrainPath.from(makeTrackRanges(edges));
    }

    /** Creates a TrainPath instance from the list of pathfinding edges */
    private static TrainPath makeTrainPath(
            List<EdgeRange<STDCMEdge>> ranges
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


    /** Converts locations on a SignalingRoute into a location on a STDCMGraph.Edge. */
    private static Set<Pathfinding.EdgeLocation<STDCMEdge>> convertLocations(
            STDCMGraph graph,
            Set<Pathfinding.EdgeLocation<SignalingRoute>> locations,
            double startTime,
            double maxDepartureDelay
    ) {
        var res = new HashSet<Pathfinding.EdgeLocation<STDCMEdge>>();
        for (var location : locations) {
            var start = location.offset();
            var edges = new STDCMEdgeBuilder(location.edge(), graph)
                    .setStartTime(startTime)
                    .setStartOffset(start)
                    .setPrevMaximumAddedDelay(maxDepartureDelay)
                    .makeAllEdges();
            for (var edge : edges)
                res.add(new Pathfinding.EdgeLocation<>(edge, location.offset()));
        }
        return res;
    }

    /** Computes the departure time, made of the sum of all delays added over the path */
    private static double computeDepartureTime(List<EdgeRange<STDCMEdge>> ranges, double startTime) {
        for (var range : ranges) {
            startTime += range.edge().addedDelay();
        }
        return startTime;
    }
}
