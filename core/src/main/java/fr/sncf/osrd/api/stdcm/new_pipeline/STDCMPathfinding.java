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
     * find a path made of a sequence of route and time blocks.
     * Returns null if no path is found.
     *
     * </p>
     * This is the second and main step to compute STDCM.
     * The amount of paths to evaluate can be quite large, so we avoid computing exact speed/time/position curves.
     * We only look for one possible "opening" we can fit a train in, which may include margins to compensate possible
     * approximations and inaccuracies.
     * */
    public static BlockPath findPath(
            SignalingInfra infra,
            Multimap<SignalingRoute, OccupancyBlock> unavailableTimes,
            RollingStock rollingStock,
            Set<PathfindingWaypoint> startLocations,
            Set<PathfindingWaypoint> endLocations
    ) {
        throw new NotImplemented();
    }
}
