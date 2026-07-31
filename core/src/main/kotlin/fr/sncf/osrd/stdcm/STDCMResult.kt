package fr.sncf.osrd.stdcm

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.geom.Point
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.sim_infra.api.RouteId
import fr.sncf.osrd.stdcm.graph.EngineeringAllowanceRange
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.units.Offset

interface STDCMResult

/**
 * This is the result of the STDCM computation. It is made of a physical path part and envelope, as
 * well as different representations of the same data that can be reused in later steps.
 */
data class STDCMCompleteResult(
    val envelope: Envelope,
    val trainPath: TrainPath,
    val rollingStocks: DistanceRangeMap<RollingStock>,
    val routePath: List<RouteId>,
    val departureTime: Double,
    val stopResults: List<TrainStop>,
    val waypointOffsets: List<Offset<PhysicsPath>>,
    val backtrackIndexes: List<Int>,
    val engineeringAllowanceRanges: List<EngineeringAllowanceRange>,
) : STDCMResult

data class STDCMPartialResult(
    val trainPath: TrainPath,
    val waypointOffsets: List<Offset<PhysicsPath>>,
    val backtrackIndexes: List<Int>,
    val earliestReachableTime: Double,
    val geoPoint: Point,
) : STDCMResult
