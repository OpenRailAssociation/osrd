package fr.sncf.osrd.api.stdcm;

import fr.sncf.osrd.api.stdcm.STDCMEndpoint.RouteOccupancy;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
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
        var block = new Block(route, entrySignal, exitSignal, id, length, maxSpeed);
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
            res.add(new BlockUse(block, startTime, endTime));
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
            EdgeLocation<SignalingRoute> startLocation,
            EdgeLocation<SignalingRoute> endLocation,
            Collection<RouteOccupancy> occupancy
    ) throws IOException {
        var usableCapacity = getUsableCapacity(infra, rollingStock, occupancy);

        var startRoute = startLocation.edge();
        var endRoute = endLocation.edge();

        String startBlockEntrySig = startRoute.getEntrySignal().getID();
        String startBlockExitSig = startRoute.getExitSignal().getID();
        String endBlockEntrySig = endRoute.getEntrySignal().getID();
        String endBlockExitSig = endRoute.getExitSignal().getID();

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
