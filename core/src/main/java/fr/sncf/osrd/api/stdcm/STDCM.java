package fr.sncf.osrd.api.stdcm;

import fr.sncf.osrd.api.stdcm.STDCMEndpoint.RouteOccupancy;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeLocation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.io.IOException;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

public class STDCM {
    static final Logger logger = LoggerFactory.getLogger(STDCM.class);

    public static final double TIME_WORLD_START = 0.;
    public static final double TIME_WORLD_END = 3600. * 24;

    private static Block makeBlock(SignalingInfra infra, RollingStock rollingStock, String id) {
        var route = infra.findSignalingRoute(id, "BAL3");
        var entrySignal = route.getEntrySignal();
        var exitSignal = route.getEntrySignal();
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
        return new Block(route, entrySignal, exitSignal, id, length, maxSpeed);
    }

    private static ArrayList<BlockUse> computeBlockUsableCapacity(Block block, List<RouteOccupancy> occupancies) {
        occupancies.sort(Comparator.comparingDouble(blockUse -> blockUse.startOccupancyTime));

        var res = new ArrayList<BlockUse>();

        // +-----+----+----+-------+----------+
        // |     |////|    |///////|          |
        // +-----+----+----+-------+----------+
        double lastOccupied = TIME_WORLD_START;
        for (var occupancy : occupancies) {
            // coalesce overlapping / continuous occupancies together
            if (occupancy.startOccupancyTime <= lastOccupied) {
                lastOccupied = occupancy.endOccupancyTime;
                continue;
            }

            var startTime = lastOccupied;
            var endTime = occupancy.startOccupancyTime;
            res.add(new BlockUse(block, startTime, endTime));
            lastOccupied = occupancy.endOccupancyTime;
        }
        res.add(new BlockUse(block, lastOccupied, TIME_WORLD_END));
        return res;
    }



    private static Map<Block, List<BlockUse>> getUsableCapacity(
            SignalingInfra infra,
            RollingStock rollingStock,
            Collection<RouteOccupancy> occupancies
    ) {
        // 1) sort occupancies per block
        var perBlockOccupancy = new HashMap<String, List<RouteOccupancy>>();
        for (var routeID : infra.getReservationRouteMap().keySet())
            perBlockOccupancy.put(routeID, new ArrayList<>());

        for (var occupancy : occupancies) {
            var blockOccupancy = perBlockOccupancy.get(occupancy.id);
            blockOccupancy.add(occupancy);
        }

        // 2) compute the usable capacity (the not-occupied time lapses for all blocks)
        var res = new HashMap<Block, List<BlockUse>>();
        perBlockOccupancy.forEach((id, blockOccupancy) -> {
            var block = makeBlock(infra, rollingStock, id);
            res.put(block, computeBlockUsableCapacity(block, blockOccupancy));
        });
        return res;
    }

    /** Picks the shortest path */
    public static List<BlockUse> findBestPath(
            ArrayList<List<BlockUse>> allPossiblePaths,
            Function<BlockUse, Double> weightFunc
    ) {
        double bestWeight = Double.POSITIVE_INFINITY;
        List<BlockUse> bestPath = null;

        for (var possiblePath : allPossiblePaths) {
            double pathWeight = possiblePath.stream().map(weightFunc).reduce(0., Double::sum);
            if (pathWeight >= bestWeight)
                continue;
            bestWeight = pathWeight;
            bestPath = possiblePath;
        }

        return bestPath;
    }

    /** Runs the main STDCM algorithm */
    public static List<BlockUse> run(
            SignalingInfra infra,
            RollingStock rollingStock,
            double startTime,
            double endTime,
            List<EdgeLocation<SignalingRoute>> startLocations,
            List<EdgeLocation<SignalingRoute>> endLocations,
            Collection<RouteOccupancy> occupancy
    ) {
        var usableCapacity = getUsableCapacity(infra, rollingStock, occupancy);

        var flatUsableCapacity = new ArrayList<BlockUse>();
        for (var blockUses : usableCapacity.values())
            flatUsableCapacity.addAll(blockUses);

        var startLocationEdges = startLocations.stream().map(EdgeLocation::edge).collect(Collectors.toSet());
        var endLocationEdges = endLocations.stream().map(EdgeLocation::edge).collect(Collectors.toSet());

        var config = new STDCMConfig(rollingStock, startTime, endTime, 400.,
                startLocationEdges, endLocationEdges);

        // This step generates all the possible paths that links the start and end location.
        // If going from a block to the next at the train's max speed is impossible, the path is discarded
        var allNaivePaths = PathGenerator.generatePaths(config, flatUsableCapacity);

        // This step calculates the weight of each edge
        var allRealisticPaths = PathSimulator.simulatePaths(config, allNaivePaths);
        return findBestPath(allRealisticPaths, BlockUse::impactWeight);
    }
}
