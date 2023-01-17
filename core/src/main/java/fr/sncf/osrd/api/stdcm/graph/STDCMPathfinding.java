package fr.sncf.osrd.api.stdcm.graph;

import com.google.common.collect.Multimap;
import fr.sncf.osrd.api.pathfinding.RemainingDistanceEstimator;
import fr.sncf.osrd.api.stdcm.OccupancyBlock;
import fr.sncf.osrd.api.stdcm.STDCMResult;
import fr.sncf.osrd.api.pathfinding.constraints.ElectrificationConstraints;
import fr.sncf.osrd.api.pathfinding.constraints.LoadingGaugeConstraints;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;
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
            RollingStock.Comfort comfort,
            double startTime,
            double endTime,
            Set<Pathfinding.EdgeLocation<SignalingRoute>> startLocations,
            Set<Pathfinding.EdgeLocation<SignalingRoute>> endLocations,
            Multimap<SignalingRoute, OccupancyBlock> unavailableTimes,
            double timeStep,
            double maxDepartureDelay,
            double maxRunTime,
            String tag,
            AllowanceValue standardAllowance
    ) {
        var graph = new STDCMGraph(
                infra,
                rollingStock,
                comfort,
                timeStep,
                unavailableTimes,
                maxRunTime,
                startTime,
                endLocations,
                tag,
                standardAllowance
        );

        // Initializes the constraints
        var loadingGaugeConstraints = new LoadingGaugeConstraints(List.of(rollingStock));
        var electrificationConstraints = new ElectrificationConstraints(List.of(rollingStock));

        var path = new Pathfinding<>(graph)
                .setEdgeToLength(edge -> edge.route().getInfraRoute().getLength())
                .setRemainingDistanceEstimator(makeAStarHeuristic(endLocations, rollingStock))
                .addBlockedRangeOnEdges(edge -> loadingGaugeConstraints.apply(edge.route()))
                .addBlockedRangeOnEdges(edge -> electrificationConstraints.apply(edge.route()))
                .setTotalDistanceUntilEdgeLocation(range -> totalDistanceUntilEdgeLocation(range, maxDepartureDelay))
                .runPathfinding(
                        convertLocations(graph, startLocations, startTime, maxDepartureDelay),
                        makeObjectiveFunction(endLocations)
                );
        if (path == null)
            return null;
        return STDCMPostProcessing.makeResult(
                path,
                startTime,
                graph.standardAllowance,
                rollingStock,
                timeStep,
                comfort,
                maxRunTime,
                unavailableTimes
        );
    }

    /** Make the objective function from the edge locations */
    private static List<TargetsOnEdge<STDCMEdge>> makeObjectiveFunction(
            Set<Pathfinding.EdgeLocation<SignalingRoute>> endLocations
    ) {
        return List.of(edge -> {
            var res = new HashSet<Pathfinding.EdgeLocation<STDCMEdge>>();
            for (var loc : endLocations)
                if (loc.edge().equals(edge.route()))
                    res.add(new Pathfinding.EdgeLocation<>(edge, loc.offset()));
            return res;
        });
    }

    /** Compute the total distance of a path (in s) to an edge location
     * This estimation of the total distance is used to compare paths in the pathfinding algorithm.
     * We select the shortest path (in duration), and for 2 paths with the same duration, we select the earliest one.
     * The path weight which takes into account the total duration of the path and the time shift at the departure
     * (with different weights): path_duration * searchTimeRange + departure_time_shift.
     * 
     * <br/>
     * EXAMPLE
     * Let's assume we are trying to find a train between 9am and 10am. The searchTimeRange is 1 hour (3600s).
     * Let's assume we have found two possible trains:
     * - the first one leaves at 9:59 and lasts for 20:00 min.
     * - the second one leaves at 9:00 and lasts for 20:01 min.
     * As we are looking for the fastest train, the first train should have the lightest weight, which is the case with
     * the formula above.*/
    private static double totalDistanceUntilEdgeLocation(
            Pathfinding.EdgeLocation<STDCMEdge> range,
            double searchTimeRange
    ) {
        var envelope = range.edge().envelope();
        var timeEnd = STDCMSimulations.interpolateTime(
                envelope,
                range.edge().route(),
                range.offset(),
                range.edge().timeStart(),
                range.edge().standardAllowanceSpeedFactor()
        );
        var pathDuration = timeEnd - range.edge().totalDepartureTimeShift();
        assert pathDuration >= 0;
        return pathDuration * searchTimeRange + range.edge().totalDepartureTimeShift();
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
}
