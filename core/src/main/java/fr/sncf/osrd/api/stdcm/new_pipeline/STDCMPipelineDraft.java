package fr.sncf.osrd.api.stdcm.new_pipeline;

import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.api.stdcm.STDCMEndpoint;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.train.RollingStock;
import java.util.Collection;
import java.util.Set;

public class STDCMPipelineDraft {

    /** This method is just a draft to show how the different methods are chained after one another */
    public void computeSTDCM(
            SignalingInfra infra,
            RollingStock rollingStock,
            Collection<STDCMEndpoint.RouteOccupancy> occupancies,
            Set<PathfindingWaypoint> startLocations,
            Set<PathfindingWaypoint> endLocations
    ) {
        var unavailableSpace = UnavailableSpaceBuilder.computeUnavailableSpace(
                infra,
                occupancies,
                rollingStock
        );

        var path = STDCMPathfinding.findPath(infra,
                unavailableSpace,
                rollingStock,
                startLocations,
                endLocations
        );

        var envelope = STDCMSimulation.makeSTDCMEnvelope(
                path,
                rollingStock
        );
    }
}
