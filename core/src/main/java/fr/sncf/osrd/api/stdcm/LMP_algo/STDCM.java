package fr.sncf.osrd.api.stdcm.LMP_algo;

import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.api.stdcm.Graph.Pathfinding;
import fr.sncf.osrd.api.stdcm.LMP_algo.legacy.OccupancyIntersector;
import fr.sncf.osrd.api.stdcm.LMP_algo.legacy.digital_capacity_generator;
import fr.sncf.osrd.api.stdcm.LMP_algo.legacy.max_usable_capacity;
import fr.sncf.osrd.api.stdcm.Objects.BlockUse;
import fr.sncf.osrd.api.stdcm.STDCMEndpoint;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.train.RollingStock;

import java.io.IOException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Collection;

public class STDCM {
    public static ArrayList<BlockUse> getUsableCapacity() throws ParseException {
        // first array level: is per GET (per itinerary)
        // second array level: per route
        // third level: occupancy per route
        ArrayList<ArrayList<ArrayList<BlockUse>>> perTrainOccupancy = new ArrayList<>();

        // this step takes the occupancy of each GET, and merges it with all the other GETs
        // at the end of the process, all GETs have the occupancy times from other GETs.
        var combinedOccupancy = OccupancyIntersector.intersect(perTrainOccupancy);

        // This step takes as an input the previous GETs and computes the digital capacity for each one
        // as an output we will have  a list of the digital capacity of each route
        // represented as blocks of digital capacity
        digital_capacity_generator dcg = new digital_capacity_generator();
        combinedOccupancy = dcg.digital_capacity(perTrainOccupancy, combinedOccupancy);

        // This step stores all the digital capacity blocks in a one array
        var Bfree = new ArrayList<BlockUse>();
        for (int k = 0; k < combinedOccupancy.size(); k++) {
            for (int i = 0; i < combinedOccupancy.get(k).size(); i++) {
                for (int j = 0; j < combinedOccupancy.get(k).get(i).size(); j++) {
                    var block = combinedOccupancy.get(k).get(i).get(j);
                    Bfree.add(new BlockUse(block.getT(), block.getTf(), block.getX(), block.getXf(), "(" + k + "," + i + "," + j + ")", block.getL(), 200));
                }
            }
        }

        // This step regroups all the digital capacity block per route
        max_usable_capacity muc = new max_usable_capacity();
        return muc.max_usable_capacity(Bfree);
    }

    public static ArrayList<ArrayList<BlockUse>> run(SignalingInfra infra, RollingStock rollingStock, double startTime, double endTime, Collection<PathfindingWaypoint> startPoint, Collection<PathfindingWaypoint> endPoint, Collection<STDCMEndpoint.RouteOccupancy> occupancy) throws IOException, ParseException {
        double maxTime = 3 * 3.6 * Math.pow(10, 6);
        var config = new STDCMConfig(infra, rollingStock, startTime, endTime, startPoint, endPoint, occupancy, maxTime, 400.);

        // TODO: find the IDs of the start and end signal
        int beginSignal = 0;
        int endSignal = 0;

        // compute usable capacity
        var Bfree = getUsableCapacity();

        // Get creation from routeOccupancy

        // This step generates all the possible paths that links the start and end location while taking into account
        // the simulation's parameters, by performing a physics simulation.
        // this step defines the nodes and edges of the final graph
        ArrayList<ArrayList<BlockUse>> paths = PathGenerator.generatePaths(config, Bfree, beginSignal, endSignal);

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
