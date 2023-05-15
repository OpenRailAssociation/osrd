package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.ImpossibleSimulationError
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceConvergenceException
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue.FixedTime
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.envelope_sim_infra.MRSP
import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView
import fr.sncf.osrd.stdcm.BacktrackingEnvelopeAttr
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.RollingStock.Comfort
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/** This file contains all the methods used to simulate the train behavior.
 */

/** Create an EnvelopeSimContext instance from the route and extra parameters  */
fun makeSimContext(
    routes: List<SignalingRoute>,
    offsetFirstRoute: Double,
    rollingStock: RollingStock,
    comfort: Comfort?,
    timeStep: Double
): EnvelopeSimContext {
    var mutOffsetFirstRoute = offsetFirstRoute
    val tracks = ArrayList<TrackRangeView>()
    for (route in routes) {
        val routeLength = route.infraRoute.length
        tracks.addAll(route.infraRoute.getTrackRanges(mutOffsetFirstRoute, routeLength))
        mutOffsetFirstRoute = 0.0
    }
    val envelopePath = EnvelopeTrainPath.from(tracks)
    return build(rollingStock, envelopePath, timeStep, comfort)
}

/** Returns an envelope matching the given route. The envelope time starts when the train enters the route.
 * stopPosition specifies the position at which the train should stop, may be null (no stop)
 *
 * Note: there are some approximations made here as we only "see" the tracks on the given routes.
 * We are missing slopes and speed limits from earlier in the path.
 *
 * This is public because it helps when writing unit tests.  */
fun simulateRoute(
    route: SignalingRoute,
    initialSpeed: Double,
    start: Double,
    rollingStock: RollingStock,
    comfort: Comfort?,
    timeStep: Double,
    stopPosition: Double?,
    tag: String?
): Envelope? {
    if (stopPosition != null && abs(stopPosition) < TrainPhysicsIntegrator.POSITION_EPSILON)
        return makeSinglePointEnvelope(
            0.0
        )
    if (start >= route.infraRoute.length)
        return makeSinglePointEnvelope(initialSpeed)
    val context = makeSimContext(listOf(route), start, rollingStock, comfort, timeStep)
    var stops = doubleArrayOf()
    var length = context.path.length
    if (stopPosition != null) {
        stops = doubleArrayOf(stopPosition)
        length = min(length, stopPosition)
    }
    val mrsp = MRSP.from(
        route.infraRoute.getTrackRanges(start, start + length),
        rollingStock,
        false,
        tag
    )
    return try {
        val maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, mrsp)
        MaxEffortEnvelope.from(context, initialSpeed, maxSpeedEnvelope)
    } catch (e: ImpossibleSimulationError) {
        // The train can't reach its destination, for example because of high slopes
        null
    }
}

/** Make an envelope with a single point of the given speed  */
private fun makeSinglePointEnvelope(speed: Double): Envelope {
    return Envelope.make(
        EnvelopePart(
            mutableMapOf(), doubleArrayOf(0.0), doubleArrayOf(speed), doubleArrayOf()
        )
    )
}

/** Returns the time at which the offset on the given route is reached  */
fun interpolateTime(
    envelope: Envelope,
    envelopeStartOffset: Double,
    routeOffset: Double,
    startTime: Double,
    speedRatio: Double
): Double {
    val envelopeOffset = max(0.0, routeOffset - envelopeStartOffset)
    assert(envelopeOffset <= envelope.endPos)
    return startTime + envelope.interpolateTotalTime(envelopeOffset) / speedRatio
}

/** Try to apply an allowance on the given envelope to add the given delay  */
fun findEngineeringAllowance(context: EnvelopeSimContext, oldEnvelope: Envelope, neededDelay: Double): Envelope? {
    val delayWithMargin = neededDelay + context.timeStep // error margin for the dichotomy
    val ranges = listOf(
        AllowanceRange(0.0, oldEnvelope.endPos, FixedTime(delayWithMargin))
    )
    val capacitySpeedLimit = 1 // We set a minimum because generating curves at very low speed can cause issues
    // TODO: add a parameter and set a higher default value once we can handle proper stops
    val allowance = MarecoAllowance(0.0, oldEnvelope.endPos, capacitySpeedLimit.toDouble(), ranges)
    return try {
        allowance.apply(oldEnvelope, context)
    } catch (e: AllowanceConvergenceException) {
        null
    }
}

/** Simulates a route that already has an envelope, but with a different end speed  */
fun simulateBackwards(
    route: SignalingRoute,
    endSpeed: Double,
    start: Double,
    oldEnvelope: Envelope,
    graph: STDCMGraph
): Envelope {
    val context = makeSimContext(
        listOf(route),
        start,
        graph.rollingStock,
        graph.comfort,
        graph.timeStep
    )
    val partBuilder = EnvelopePartBuilder()
    partBuilder.setAttr(EnvelopeProfile.BRAKING)
    partBuilder.setAttr(BacktrackingEnvelopeAttr())
    val overlayBuilder = ConstrainedEnvelopePartBuilder(
        partBuilder,
        SpeedConstraint(0.0, EnvelopePartConstraintType.FLOOR),
        EnvelopeConstraint(oldEnvelope, EnvelopePartConstraintType.CEILING)
    )
    EnvelopeDeceleration.decelerate(
        context,
        oldEnvelope.endPos,
        endSpeed,
        overlayBuilder,
        -1.0
    )
    val builder = OverlayEnvelopeBuilder.backward(oldEnvelope)
    builder.addPart(partBuilder.build())
    return builder.build()
}
