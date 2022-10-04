package fr.sncf.osrd.api.stdcm.new_pipeline;

import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.api.stdcm.STDCMEndpoint;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;

import java.util.Collection;
import java.util.Set;

public class STDCMPipelineDraft {

    /** This method is just a draft to show how the different methods are chained after one another */
    public STDCMResult computeSTDCM(
            SignalingInfra infra,
            RollingStock rollingStock,
            Collection<STDCMEndpoint.RouteOccupancy> occupancies,
            Set<Pathfinding.EdgeLocation<SignalingRoute>> startLocations,
            Set<Pathfinding.EdgeLocation<SignalingRoute>> endLocations,
            double timeStart,
            double timeEnd
    ) {
        var unavailableSpace = UnavailableSpaceBuilder.computeUnavailableSpace(
                infra,
                occupancies,
                rollingStock
        );

        return STDCMPathfinding.findPath(
                infra,
                rollingStock,
                timeStart,
                timeEnd,
                startLocations,
                endLocations,
                unavailableSpace,
                10.
        );
    }
}
