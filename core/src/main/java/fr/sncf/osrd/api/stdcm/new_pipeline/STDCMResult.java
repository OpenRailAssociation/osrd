package fr.sncf.osrd.api.stdcm.new_pipeline;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.utils.graph.Pathfinding;

/** This is the result of the STDCM computation
 * made of a physical path part and and envelope. */
public record STDCMResult(
        Pathfinding.Result<SignalingRoute> routes,
        Envelope envelope
) {}
