package fr.sncf.osrd.stdcm

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.PhysicsPath
import fr.sncf.osrd.graph.PathfindingResultId
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.PathProperties
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.train.TrainStop

/** This is the result of the STDCM computation.
 * It is made of a physical path part and envelope, as well as different representations
 * of the same data that can be reused in later steps.  */
data class STDCMResult(
    val blocks: PathfindingResultId<Block>,
    val envelope: Envelope,
    val trainPath: PathProperties,
    val chunkPath: ChunkPath,
    val physicsPath: PhysicsPath,
    val departureTime: Double,
    val stopResults: List<TrainStop>
)
