package fr.sncf.osrd.envelope_sim.pipelines

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeCursor
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.etcs.ETCSBrakingSimulator
import fr.sncf.osrd.envelope_sim.etcs.ETCSBrakingSimulatorImpl
import fr.sncf.osrd.envelope_sim.etcs.EndOfAuthority
import fr.sncf.osrd.envelope_sim.etcs.EoaType
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration
import fr.sncf.osrd.path.interfaces.TravelledPath
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset

/**
 * Max speed envelope = MRSP + braking curves It is the max speed allowed at any given point,
 * ignoring allowances
 */

/**
 * Simple data class used to pass stop data to the class. Combines the stop offset with the
 * closed/open signal flag.
 */
data class SimStop(
    val offset: Offset<TravelledPath>,
    val rjsReceptionSignal: RJSTrainStop.RJSReceptionSignal,
)

fun increase(prevPos: Double, prevSpeed: Double, nextPos: Double, nextSpeed: Double): Boolean {
    // Works for both accelerations (forwards) and decelerations (backwards)
    return prevSpeed < nextSpeed
}

/**
 * Generate braking curves overlay everywhere the mrsp decrease (increase backwards) with a
 * discontinuity
 */
private fun addSlowdownBrakingCurves(
    etcsSimulator: ETCSBrakingSimulator,
    context: EnvelopeSimContext,
    mrsp: Envelope,
): Envelope {
    var envelope = mrsp
    envelope = addETCSSlowdownBrakingCurves(etcsSimulator, envelope)
    envelope = addConstSlowdownBrakingCurves(context, envelope)
    return envelope
}

/**
 * Generate braking curves overlay everywhere the mrsp decreases (increases backwards) with a
 * discontinuity using constant deceleration (outside ETCS ranges).
 */
private fun addConstSlowdownBrakingCurves(
    context: EnvelopeSimContext,
    envelope: Envelope,
): Envelope {
    val builder = OverlayEnvelopeBuilder.backward(envelope)
    val cursor = EnvelopeCursor.backward(envelope)
    var lastPosition = envelope.endPos
    while (cursor.findPartTransition(::increase)) {
        if (cursor.position > lastPosition) {
            // The next braking curve already covers this point, this braking curve is hidden
            cursor.nextPart()
            continue
        }
        val partBuilder = EnvelopePartBuilder()
        partBuilder.setAttr(EnvelopeProfile.BRAKING)
        val overlayBuilder =
            ConstrainedEnvelopePartBuilder(
                partBuilder,
                SpeedConstraint(0.0, EnvelopePartConstraintType.FLOOR),
                EnvelopeConstraint(envelope, EnvelopePartConstraintType.CEILING),
            )
        val startSpeed = cursor.speed
        val startPosition = cursor.position
        // TODO: link directionSign to cursor boolean reverse
        EnvelopeDeceleration.decelerate(context, startPosition, startSpeed, overlayBuilder, -1.0)
        builder.addPart(partBuilder.build())
        cursor.nextPart()
        lastPosition = overlayBuilder.lastPos
    }
    return builder.build()
}

/** Add braking curves following ETCS rules in relevant places */
private fun addETCSSlowdownBrakingCurves(
    etcsSimulator: ETCSBrakingSimulator,
    envelope: Envelope,
): Envelope {
    val limitsOfAuthority = etcsSimulator.computeLoaLocations(envelope)
    return etcsSimulator.addSlowdownBrakingCurves(envelope, limitsOfAuthority)
}

/** Generate braking curves overlay at every stop position */
private fun addStopBrakingCurves(
    etcsSimulator: ETCSBrakingSimulator,
    context: EnvelopeSimContext,
    stops: List<SimStop>,
    curveWithDecelerations: Envelope,
): Envelope {
    var envelope = curveWithDecelerations
    val etcsStops =
        etcsSimulator.computeEoaLocations(
            curveWithDecelerations,
            stops.map { it.offset },
            stops.map { it.rjsReceptionSignal.isStopOnClosedSignal },
            EoaType.STOP,
        )
    val constStops =
        stops
            .filter { stop ->
                stop.offset.distance != Distance.ZERO &&
                    !etcsStops.map { it.offsetEOA }.contains(stop.offset)
            }
            .map { it.offset }
    envelope = addETCSStopBrakingCurves(etcsSimulator, envelope, etcsStops)
    envelope = addConstStopBrakingCurves(context, envelope, constStops)
    return envelope
}

/** Generate braking curves overlay at every stop position */
private fun addConstStopBrakingCurves(
    context: EnvelopeSimContext,
    curveWithDecelerations: Envelope,
    stops: List<Offset<TravelledPath>>,
): Envelope {
    var envelope = curveWithDecelerations
    for (stop in stops) {
        val partBuilder = EnvelopePartBuilder()
        partBuilder.setAttr(EnvelopeProfile.BRAKING)
        val overlayBuilder =
            ConstrainedEnvelopePartBuilder(
                partBuilder,
                SpeedConstraint(0.0, EnvelopePartConstraintType.FLOOR),
                EnvelopeConstraint(envelope, EnvelopePartConstraintType.CEILING),
            )
        EnvelopeDeceleration.decelerate(context, stop.meters, 0.0, overlayBuilder, -1.0)

        val builder = OverlayEnvelopeBuilder.backward(envelope)
        builder.addPart(partBuilder.build())
        envelope = builder.build()
    }
    return envelope
}

/** Add braking parts for any ETCS flagged stop. */
private fun addETCSStopBrakingCurves(
    simulator: ETCSBrakingSimulator,
    envelope: Envelope,
    stops: List<EndOfAuthority>,
): Envelope {
    return simulator.addStopBrakingCurves(envelope, stops)
}

/** Generate a max speed envelope given a mrsp */
fun maxSpeedEnvelopeFrom(
    context: EnvelopeSimContext,
    stops: List<SimStop>,
    mrsp: Envelope,
): Envelope {
    val etcsSimulator = ETCSBrakingSimulatorImpl(context)
    var maxSpeedEnvelope = addSlowdownBrakingCurves(etcsSimulator, context, mrsp)
    maxSpeedEnvelope = addStopBrakingCurves(etcsSimulator, context, stops, maxSpeedEnvelope)
    return maxSpeedEnvelope
}
