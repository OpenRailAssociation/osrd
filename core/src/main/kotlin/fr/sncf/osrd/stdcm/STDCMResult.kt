package fr.sncf.osrd.stdcm

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.PhysicsPath
import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import fr.sncf.osrd.infra_state.api.TrainPath
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.graph.Pathfinding

/** This is the result of the STDCM computation.
 * It is made of a physical path part and envelope, as well as different representations
 * of the same data that can be reused in later steps.  */
@JvmRecord
data class STDCMResult(
    @JvmField val routes: Pathfinding.Result<SignalingRoute>,
    @JvmField val envelope: Envelope,
    @JvmField val trainPath: TrainPath,
    val physicsPath: PhysicsPath,
    @JvmField val departureTime: Double,
    @JvmField val stopResults: MutableList<TrainStop>
)
