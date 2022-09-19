package fr.sncf.osrd.api.stdcm.new_pipeline;

import com.google.common.collect.Multimap;
import fr.sncf.osrd.api.stdcm.STDCMEndpoint;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.reporting.exceptions.NotImplemented;
import fr.sncf.osrd.train.RollingStock;
import java.util.Collection;

public class UnavailableSpaceBuilder {

    /** Computes the unavailable space for each route, i.e.
     * the times and positions where the *head* of the train cannot be.
     * This considers existing occupancy blocks, the length of the train,
     * and the routes that must be left available behind the train
     *
     * </p>
     * This is the first step to compute STDCM, the goal is to get rid of railway rules and extra complexity
     * as soon as possible. After this step we can look for a single curve that avoids unavailable blocks. */
    public static Multimap<SignalingRoute, OccupancyBlock> computeUnavailableSpace(
            SignalingInfra infra,
            Collection<STDCMEndpoint.RouteOccupancy> occupancies,
            RollingStock rollingStock
    ) {
        throw new NotImplemented();
    }
}
