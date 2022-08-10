package fr.sncf.osrd.api.stdcm.LMP_algo;

import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.api.stdcm.Graph.Pathfinding;
import fr.sncf.osrd.api.stdcm.LMP_algo.legacy.OccupancyIntersector;
import fr.sncf.osrd.api.stdcm.LMP_algo.legacy.digital_capacity_generator;
import fr.sncf.osrd.api.stdcm.LMP_algo.legacy.max_usable_capacity;
import fr.sncf.osrd.api.stdcm.Objects.BlockUse;
import fr.sncf.osrd.api.stdcm.STDCMEndpoint;
import fr.sncf.osrd.api.stdcm.STDCMEndpoint.RouteOccupancy;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.train.RollingStock;

import java.io.IOException;
import java.text.ParseException;
import java.util.*;

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
                                .reduce(Double.POSITIVE_INFINITY, Math::min)
                    })
                    // find the minimum
                    .reduce(Double.POSITIVE_INFINITY, Math::min);
            res.add(new BlockUse(startTime, endTime, entrySignal, exitSignal, id, length, maxSpeed));
            lastOccupied = occupancy.endOccupancyTime;
        }
        return res;
    }

    private static ArrayList<BlockUse> getUsableCapacity(SignalingInfra infra, Collection<RouteOccupancy> occupancies) {
        // 1) sort occupancies per block
        var perBlockOccupancy = new HashMap<String, List<RouteOccupancy>>();
        for (var occupancy : occupancies) {
            var blockOccupancy = perBlockOccupancy.computeIfAbsent(occupancy.id, id -> new ArrayList<>());
            blockOccupancy.add(occupancy);
        }

        // 2) compute the usable capacity (the not-occupied time lapses for all blocks)
        var res = new ArrayList<BlockUse>();
        for (var blockOccupancies : perBlockOccupancy.values())
            res.addAll(computeBlockUsableCapacity(blockOccupancies));
        return res;
    }

    public static ArrayList<ArrayList<BlockUse>> run(SignalingInfra infra, RollingStock rollingStock, double startTime, double endTime, Collection<PathfindingWaypoint> startPoint, Collection<PathfindingWaypoint> endPoint, Collection<RouteOccupancy> occupancy) throws IOException, ParseException {
        // TODO: adapt input
        var usableCapacity = getUsableCapacity(infra, occupancy);

        // TODO: find the IDs of the start and end signal
        String startBlockEntrySig = null;
        String startBlockExitSig = null;
        String exitBlockEntrySig = null;
        String exitBlockExitSig = null;

        double maxTime = 3 * 3.6 * Math.pow(10, 6);
        var config = new STDCMConfig(rollingStock, startTime, endTime, maxTime, 400., startBlockEntrySig, startBlockExitSig, exitBlockEntrySig, exitBlockExitSig);

        // Get creation from routeOccupancy

        // This step generates all the possible paths that links the start and end location while taking into account
        // the simulation's parameters, by performing a physics simulation.
        // this step defines the nodes and edges of the final graph
        var paths = PathGenerator.generatePaths(config, usableCapacity);

        // This step calculates the weight of each edge
        var SOL2 = DCM_paths.DCM_paths(config, paths);

        var builder = Pathfinding.graph_builder(SOL2);
        var g = Pathfinding.graph_generation(builder);
        // TODO: add BlockUse as an edge attribute
        var result = Pathfinding.shortest_LMP(g, builder);
        var T = Pathfinding.getIndexTable();

        var res = new ArrayList<BlockUse>();
        // TODO: convert the result of the pathfinding back to blockuse
        return
    }
}
