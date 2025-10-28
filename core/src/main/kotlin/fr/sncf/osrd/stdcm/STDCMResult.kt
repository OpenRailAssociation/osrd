package fr.sncf.osrd.stdcm

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.sim_infra.api.RouteId
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.units.Offset

/**
 * This is the result of the STDCM computation. It is made of a physical path part and envelope, as
 * well as different representations of the same data that can be reused in later steps.
 */
data class STDCMResult(
    val envelope: Envelope,
    val trainPath: TrainPath,
    val routePath: List<RouteId>,
    val departureTime: Double,
    val stopResults: List<TrainStop>,
    val waypointOffsets: List<Offset<TrainPath>>,
)
