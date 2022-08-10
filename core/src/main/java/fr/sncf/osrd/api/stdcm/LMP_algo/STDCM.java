package fr.sncf.osrd.api.stdcm.LMP_algo;

import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.api.stdcm.Objects.BlockUse;
import fr.sncf.osrd.api.stdcm.STDCMEndpoint;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.train.RollingStock;

import java.io.IOException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Collection;

public class STDCM {

    public  ArrayList<ArrayList<BlockUse>> run(SignalingInfra infra, RollingStock rollingStock, double startTime, double endTime, Collection<PathfindingWaypoint> startPoint, Collection<PathfindingWaypoint> endPoint, Collection<STDCMEndpoint.RouteOccupancy> occupancy) throws IOException, ParseException {



        // first array level: is per GET (per itinerary)
        // second array level: per route
        // third level: occupancy per route
       // ArrayList<ArrayList<ArrayList<BlockUse>>> Get1 = reader.reader(args);

        // this step takes the occupancy of each GET, and merges it with all the other GETs
        // at the end of the process, all GETs have the occupancy times from other GETs.

        Intersection_get inter_get = new Intersection_get();
        ArrayList<ArrayList<ArrayList<BlockUse>>> Get1free = inter_get.intersection(Get1);

        //This step takes as an input the previous GETs and computes the digital capacity for each one
        //as an output we will have  a list of the digital capacity of each route
        //represented as blocks of digital capacity
        digital_capacity_generator dcg = new digital_capacity_generator();
        Get1free = dcg.digital_capacity(Get1,Get1free);


        // This step stores all the digital capacity blocks in a one array
        System.out.println("step 3:Storing digital capacity blocks ");

        ArrayList<BlockUse> Bfree = new ArrayList<BlockUse>();

        for(int k=0;k<Get1free.size();k++) {
            for(int i=0;i<Get1free.get(k).size();i++) {
                for(int j=0;j<Get1free.get(k).get(i).size();j++) {
                    var block = Get1free.get(k).get(i).get(j);
                    Bfree.add(new BlockUse(block.getT(),block.getTf(),block.getX(),block.getXf(),"("+k+","+i+","+j+")",block.getL(),200));
                 }
            }
        }

        //


        //This step regroups all the digital capacity block per route
        max_usable_capacity muc= new max_usable_capacity();
        Bfree= muc.max_usable_capacity(Bfree);

        //Get creation form routeOccupancy



        //This step generates all the possible paths that links the start and end location while taking into account
        //the simulation's parameters
        //this step defines the nodes and edges of the final graph
        path_generation pg= new path_generation();
        ArrayList<ArrayList<BlockUse>> paths = pg.path_generator(Bfree);

        //This step calculates the weight of each edge
        DCM_paths dcmp= new DCM_paths();
        ArrayList<ArrayList<BlockUse>> SOL2 = dcmp.DCM_paths(paths);

        return SOL2;
    }
}
