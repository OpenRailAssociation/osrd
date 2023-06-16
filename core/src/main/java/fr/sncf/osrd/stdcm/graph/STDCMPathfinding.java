package fr.sncf.osrd.stdcm.graph;

import fr.sncf.osrd.api.pathfinding.PathfindingRoutesEndpoint;
import fr.sncf.osrd.stdcm.STDCMResult;
import fr.sncf.osrd.api.pathfinding.constraints.LegacyElectrificationConstraints;
import fr.sncf.osrd.api.pathfinding.constraints.LegacyLoadingGaugeConstraints;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.stdcm.STDCMStep;
import fr.sncf.osrd.stdcm.preprocessing.interfaces.RouteAvailabilityInterface;
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
            List<STDCMStep> steps,
            RouteAvailabilityInterface routeAvailability,
            double timeStep,
            double maxDepartureDelay,
            double maxRunTime,
            String tag,
            AllowanceValue standardAllowance
    ) {
        assert steps.size() >= 2 : "Not enough steps have been set to find a path";
        var graph = new STDCMGraph(
                infra,
                rollingStock,
                comfort,
                timeStep,
                routeAvailability,
                maxRunTime,
                startTime,
                steps,
                tag,
                standardAllowance
        );

        // Initializes the constraints
        var loadingGaugeConstraints = new LegacyLoadingGaugeConstraints(List.of(rollingStock));
        var electrificationConstraints = new LegacyElectrificationConstraints(List.of(rollingStock));

        // Initialize the A* heuristic
        var locations = steps.stream()
                .map(STDCMStep::locations)
                .toList();
        var remainingDistanceEstimators = PathfindingRoutesEndpoint.makeHeuristics(locations);

        var path = new Pathfinding<>(graph)
                .setEdgeToLength(edge -> edge.route().getInfraRoute().getLength())
                .setRemainingDistanceEstimator(makeAStarHeuristic(remainingDistanceEstimators, rollingStock))
                .setEdgeToLength(STDCMEdge::getLength)
                .addBlockedRangeOnEdges(edge -> loadingGaugeConstraints.apply(edge.route()))
                .addBlockedRangeOnEdges(edge -> electrificationConstraints.apply(edge.route()))
                .setTotalCostUntilEdgeLocation(range -> totalCostUntilEdgeLocation(range, maxDepartureDelay))
                .runPathfinding(
                        convertLocations(graph, steps.get(0).locations(), startTime, maxDepartureDelay),
                        makeObjectiveFunction(steps)
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
                routeAvailability
        );
    }

    /** Make the objective function from the edge locations */
    private static List<TargetsOnEdge<STDCMEdge>> makeObjectiveFunction(
            List<STDCMStep> steps
    ) {
        var globalResult = new ArrayList<TargetsOnEdge<STDCMEdge>>();
        for (int i = 1; i < steps.size(); i++) {
            var step = steps.get(i);
            globalResult.add((edge) -> {
                var res = new HashSet<Pathfinding.EdgeLocation<STDCMEdge>>();
                for (var loc : step.locations())
                    if (loc.edge().equals(edge.route())) {
                        var offsetOnEdge = loc.offset() - edge.envelopeStartOffset();
                        if (offsetOnEdge >= 0 && offsetOnEdge <= edge.getLength())
                            res.add(new Pathfinding.EdgeLocation<>(edge, offsetOnEdge));
                    }
                return res;
            });
        }
        return globalResult;
    }

    /** Compute the total cost of a path (in s) to an edge location
     * This estimation of the total cost is used to compare paths in the pathfinding algorithm.
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
    private static double totalCostUntilEdgeLocation(
            Pathfinding.EdgeLocation<STDCMEdge> range,
            double searchTimeRange
    ) {
        var envelope = range.edge().envelope();
        var timeEnd = STDCMSimulations.interpolateTime(
                envelope,
                range.edge().envelopeStartOffset(),
                range.offset(),
                range.edge().timeStart(),
                range.edge().standardAllowanceSpeedFactor()
        );
        var pathDuration = timeEnd - range.edge().totalDepartureTimeShift();
        return pathDuration * searchTimeRange + range.edge().totalDepartureTimeShift();
    }

    /** Converts the "raw" heuristics based on infra graph, returning the most optimistic distance,
     * into heuristics based on stdcm edges, returning the most optimistic time */
    private static List<AStarHeuristic<STDCMEdge>> makeAStarHeuristic(
            ArrayList<AStarHeuristic<SignalingRoute>> signalingRouteHeuristics,
            RollingStock rollingStock
    ) {
        var res = new ArrayList<AStarHeuristic<STDCMEdge>>();
        for (var signalingRouteHeuristic : signalingRouteHeuristics) {
            res.add((edge, offset) -> {
                var distance = signalingRouteHeuristic.apply(edge.route(), offset);
                return distance / rollingStock.maxSpeed;
            });
        }
        return res;
    }

    /** Converts locations on a SignalingRoute into a location on a STDCMGraph.Edge. */
    private static Set<Pathfinding.EdgeLocation<STDCMEdge>> convertLocations(
            STDCMGraph graph,
            Collection<Pathfinding.EdgeLocation<SignalingRoute>> locations,
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
                res.add(new Pathfinding.EdgeLocation<>(edge, 0));
        }
        return res;
    }
}
