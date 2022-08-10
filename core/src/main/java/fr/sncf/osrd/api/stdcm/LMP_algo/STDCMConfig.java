package fr.sncf.osrd.api.stdcm.LMP_algo;

import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.api.stdcm.STDCMEndpoint;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.train.RollingStock;

import java.util.Collection;

public final class STDCMConfig {
    public final SignalingInfra infra;
    public final RollingStock rollingStock;
    public final double startTime;
    public final double endTime;
    public final Collection<PathfindingWaypoint> startPoint;
    public final Collection<PathfindingWaypoint> endPoint;
    public final Collection<STDCMEndpoint.RouteOccupancy> occupancy;
    public final double maxTime;

    /** A self-contained STDCM input configuration */
    public STDCMConfig(
            SignalingInfra infra,
            RollingStock rollingStock,
            double startTime,
            double endTime,
            Collection<PathfindingWaypoint> startPoint,
            Collection<PathfindingWaypoint> endPoint,
            Collection<STDCMEndpoint.RouteOccupancy> occupancy,
            double maxTime) {
        this.infra = infra;
        this.rollingStock = rollingStock;
        this.startTime = startTime;
        this.endTime = endTime;
        this.startPoint = startPoint;
        this.endPoint = endPoint;
        this.occupancy = occupancy;
        this.maxTime = maxTime;
    }
}
