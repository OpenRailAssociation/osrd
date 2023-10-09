package fr.sncf.osrd.stdcm;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.PhysicsPath;
import fr.sncf.osrd.sim_infra.api.PathProperties;
import fr.sncf.osrd.sim_infra.impl.ChunkPath;
import fr.sncf.osrd.train.TrainStop;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.List;

/** This is the result of the STDCM computation.
 * It is made of a physical path part and envelope, as well as different representations
 * of the same data that can be reused in later steps. */
public record STDCMResult(
        Pathfinding.Result<Integer> blocks,
        Envelope envelope,
        PathProperties trainPath,
        ChunkPath chunkPath,
        PhysicsPath physicsPath,
        double departureTime,
        List<TrainStop> stopResults
) {}
