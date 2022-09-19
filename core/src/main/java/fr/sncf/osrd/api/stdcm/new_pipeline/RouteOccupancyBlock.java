package fr.sncf.osrd.api.stdcm.new_pipeline;

import fr.sncf.osrd.infra.api.signaling.SignalingRoute;

/** This is a single element of the STDCM pathfinding result. */
public record RouteOccupancyBlock(
        SignalingRoute route,  // The route used for this step of the path
        double earliestAvailableTime, // The route is available from this time on
        double latestAvailableTime  // The route is unavailable after this time
) {}
