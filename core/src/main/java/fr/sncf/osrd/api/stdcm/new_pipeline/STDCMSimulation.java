package fr.sncf.osrd.api.stdcm.new_pipeline;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.reporting.exceptions.NotImplemented;
import fr.sncf.osrd.train.RollingStock;

public class STDCMSimulation {
    /** Given a path made of a sequence of route and time blocks,
     * computes a realistic simulation on that path.
     * The *head* of the train is never in a route before or after it's available.
     *
     * </p>
     * This is the third and last step to compute STDCM.
     * We have found an opening, both in terms of tracks/routes and occupancy opening, and we now compute
     * an exact simulation. We should look for the fastest path that doesn't step outside the occupancy bounds.
     * */
    public static Envelope makeSTDCMEnvelope(
            BlockPath path,
            RollingStock rollingStock
    ) {
        throw new NotImplemented();
    }
}
