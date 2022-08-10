package fr.sncf.osrd.api.stdcm.Launcher;


import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.api.stdcm.Graph.Pathfinding;
import fr.sncf.osrd.api.stdcm.LMP_algo.STDCM;
import fr.sncf.osrd.api.stdcm.Objects.BlockUse;
import fr.sncf.osrd.api.stdcm.STDCMEndpoint;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.train.RollingStock;

import java.io.IOException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Collection;


public class Launcher {

      public static ArrayList<BlockUse> main(SignalingInfra infra, RollingStock rollingStock, double startTime, double endTime, Collection<PathfindingWaypoint> startPoint, Collection<PathfindingWaypoint> endPoint, Collection<STDCMEndpoint.RouteOccupancy> occupancy) throws ParseException, IOException {

        STDCM sol= new STDCM();
        ArrayList<ArrayList<BlockUse>> SOL2=sol.run(infra, rollingStock, startTime,  endTime, startPoint,  endPoint, occupancy);

        var builder= Pathfinding.graph_builder(SOL2);
        var g=Pathfinding.graph_generation(builder);

        var result=Pathfinding.shortest_LMP(g,builder);

        var T=Pathfinding.getIndexTable();

        ArrayList<BlockUse> path=;

        return path;
    }
}




