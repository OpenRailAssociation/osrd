package fr.sncf.osrd.stdcm;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.PhysicsPath;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.utils.graph.Pathfinding;

/** This is the result of the STDCM computation.
 * It is made of a physical path part and envelope, as well as different representations
 * of the same data that can be reused in later steps. */
public record STDCMResult(
        Pathfinding.Result<SignalingRoute> routes,
        Envelope envelope,
        TrainPath trainPath,
        PhysicsPath physicsPath,
        double departureTime
) {}
