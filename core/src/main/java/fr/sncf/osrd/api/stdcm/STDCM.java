package fr.sncf.osrd.api.stdcm;

import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.api.stdcm.STDCMEndpoint.RouteOccupancy;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeLocation;

import java.io.IOException;
import java.util.*;
import java.util.function.Function;

public class STDCM {
    private static ArrayList<BlockUse> computeBlockUsableCapacity(SignalingInfra infra, RollingStock rollingStock, String id, List<RouteOccupancy> occupancies) {
        occupancies.sort(Comparator.comparingDouble(blockUse -> blockUse.startOccupancyTime));

        var route = infra.findSignalingRoute(id, "BAL3");
        var entrySignal = route.getEntrySignal().getID();
        var exitSignal = route.getEntrySignal().getID();
        var res = new ArrayList<BlockUse>();

        // +-----+----+----+-------+----------+
        // |     |////|    |///////|          |
        // +-----+----+----+-------+----------+
        double lastOccupied = Double.NEGATIVE_INFINITY;
        for (var occupancy : occupancies) {
            // coalesce overlapping / continuous occupancies together
            if (occupancy.startOccupancyTime <= lastOccupied) {
                lastOccupied = occupancy.endOccupancyTime;
                continue;
            }

            var startTime = lastOccupied;
            var endTime = occupancy.startOccupancyTime;
            var length = route.getInfraRoute().getLength();
            var maxSpeed = route.getInfraRoute().getTrackRanges()
                    .stream()
                    // for each track section range the route spans onto
                    .map(trackRange -> {
                        // get the speed limits on this speed section range
                        return trackRange.getSpeedSections().asMapOfRanges().values().stream()
                                // TODO: speed limits per category
                                // compute the limit for our rolling stock
                                .map(speedLimits -> speedLimits.getSpeedLimit(List.of()))
                                // find the minimum
                                .reduce(Double.POSITIVE_INFINITY, Math::min);
                    })
                    // find the minimum
                    .reduce(Double.POSITIVE_INFINITY, Math::min);
            res.add(new BlockUse(startTime, endTime, entrySignal, exitSignal, id, length, maxSpeed));
            lastOccupied = occupancy.endOccupancyTime;
        }
        return res;
    }

    private static ArrayList<BlockUse> getUsableCapacity(SignalingInfra infra, RollingStock rollingStock, Collection<RouteOccupancy> occupancies) {
        // 1) sort occupancies per block
        var perBlockOccupancy = new HashMap<String, List<RouteOccupancy>>();
        for (var occupancy : occupancies) {
            var blockOccupancy = perBlockOccupancy.computeIfAbsent(occupancy.id, id -> new ArrayList<>());
            blockOccupancy.add(occupancy);
        }

        // 2) compute the usable capacity (the not-occupied time lapses for all blocks)
        var res = new ArrayList<BlockUse>();
        perBlockOccupancy.forEach((id, blockOccupancy) -> {
            res.addAll(computeBlockUsableCapacity(infra, rollingStock, id, blockOccupancy));
        });
        return res;
    }

    private static List<EdgeLocation<SignalingRoute>> findRoutes(SignalingInfra infra, PathfindingWaypoint waypoint) {
        var res = new ArrayList<EdgeLocation<SignalingRoute>>();
        var edge = infra.getEdge(waypoint.trackSection(), Direction.fromEdgeDir(waypoint.direction()));
        assert (edge != null);
        for (var entry : infra.getRoutesOnEdges().get(edge)) {
            var signalingRoutes = infra.getRouteMap().get(entry.route());
            for (var signalingRoute : signalingRoutes) {
                var waypointOffsetFromStart = waypoint.offset();
                if (waypoint.direction().equals(EdgeDirection.STOP_TO_START))
                    waypointOffsetFromStart = edge.getEdge().getLength() - waypoint.offset();
                var offset = waypointOffsetFromStart - entry.startOffset();
                if (offset >= 0 && offset <= signalingRoute.getInfraRoute().getLength())
                    res.add(new EdgeLocation<>(signalingRoute, offset));
            }
        }
        return res;
    }

    private static List<EdgeLocation<SignalingRoute>> findRoutes(SignalingInfra infra, Collection<PathfindingWaypoint> waypoints) {
        var res = new ArrayList<EdgeLocation<SignalingRoute>>();
        for (var waypoint : waypoints)
            res.addAll(findRoutes(infra, waypoint));
        return res;
    }

    public static ArrayList<BlockUse> findBestPath(
            ArrayList<ArrayList<BlockUse>> allPossiblePaths,
            Function<BlockUse, Double> weightFunc
    ) {
        double bestWeight = Double.POSITIVE_INFINITY;
        ArrayList<BlockUse> bestPath = null;

        for (var possiblePath : allPossiblePaths) {
            double pathWeight = possiblePath.stream().map(weightFunc).reduce(0., Double::sum);
            if (pathWeight >= bestWeight)
                continue;
            bestWeight = pathWeight;
            bestPath = possiblePath;
        }

        return bestPath;
    }

    public static ArrayList<BlockUse> run(
            SignalingInfra infra,
            RollingStock rollingStock,
            double startTime,
            double endTime,
            Collection<PathfindingWaypoint> startPoint,
            Collection<PathfindingWaypoint> endPoint,
            Collection<RouteOccupancy> occupancy
    ) throws IOException {
        var usableCapacity = getUsableCapacity(infra, rollingStock, occupancy);

        var startLocations = findRoutes(infra, startPoint);
        var endLocations = findRoutes(infra, endPoint);

        // TODO: the current stdcm algorithm only works from a single start / end route, but the exposed API
        //   can take multiple start / end track locations, which all can yield multiple routes. That's not good.
        var electedStartRoute = startLocations.get(0).edge();
        var electedEndRoute = endLocations.get(0).edge();

        String startBlockEntrySig = electedStartRoute.getEntrySignal().getID();
        String startBlockExitSig = electedStartRoute.getExitSignal().getID();
        String endBlockEntrySig = electedEndRoute.getEntrySignal().getID();
        String endBlockExitSig = electedEndRoute.getExitSignal().getID();

        double maxTime = 3 * 3.6 * Math.pow(10, 6);
        var config = new STDCMConfig(rollingStock, startTime, endTime, maxTime, 400.,
                startBlockEntrySig, startBlockExitSig, endBlockEntrySig, endBlockExitSig);

        // This step generates all the possible paths that links the start and end location.
        // If going from a block to the next at the train's max speed is impossible, the path is discarded
        var allNaivePaths = PathGenerator.generatePaths(config, usableCapacity);

        // This step calculates the weight of each edge
        var allRealisticPaths = PathSimulator.simulatePaths(config, allNaivePaths);
        return findBestPath(allRealisticPaths, BlockUse::impactWeight);
    }
}
