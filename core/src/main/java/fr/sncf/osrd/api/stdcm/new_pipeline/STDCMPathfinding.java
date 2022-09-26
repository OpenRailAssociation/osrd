package fr.sncf.osrd.api.stdcm.new_pipeline;

import com.google.common.collect.Multimap;
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.reporting.exceptions.NotImplemented;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.List;
import java.util.Set;

public class STDCMPathfinding {

    /** Given an infra, a rolling stock and a collection of unavailable time for each route,
     * find a path made of a sequence of route ranges with a matching envelope.
     * Returns null if no path is found.
     * */
    public static STDCMResult findPath(
            SignalingInfra infra,
            RollingStock rollingStock,
            double timeStart,
            double timeEnd,
            Set<Pathfinding.EdgeLocation<SignalingRoute>> startLocations,
            Set<Pathfinding.EdgeLocation<SignalingRoute>> endLocations,
            Multimap<SignalingRoute, OccupancyBlock> unavailableTimes
    ) {
        throw new NotImplemented();
    }
}
