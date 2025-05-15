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
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator
import fr.sncf.osrd.envelope_sim.etcs.BrakingType.IND
import fr.sncf.osrd.envelope_sim.etcs.BrakingType.PS
import fr.sncf.osrd.envelope_sim.etcs.ETCSBrakingSimulator
import fr.sncf.osrd.envelope_sim.etcs.ETCSBrakingSimulatorImpl
import fr.sncf.osrd.envelope_sim.etcs.EndOfAuthority
import fr.sncf.osrd.envelope_sim.etcs.LimitOfAuthority
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.TravelledPath
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

/**
 * Max speed envelope = MRSP + braking curves It is the max speed allowed at any given point,
 * ignoring allowances
 */
object MaxSpeedEnvelope {
    /**
     * Simple data class used to pass stop data to the class. Combines the stop offset with the
     * closed/open signal flag.
     */
    data class SimStopInfo(val position: Double, val rjsReceptionSignal: RJSReceptionSignal)

    /**
     * Simple data class for easier processing, local to this file. Combines the stop offset with
     * the "etcs" and closed/open signal flags.
     */
    private data class SimStop(
        val offset: Double,
        val isETCS: Boolean,
        val rjsReceptionSignal: RJSReceptionSignal,
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
        mrsp: Envelope
    ): Envelope {
        var envelope = mrsp
        envelope = addETCSSlowdownBrakingCurves(etcsSimulator, context, envelope)
        envelope = addConstSlowdownBrakingCurves(context, envelope)
        return envelope
    }

    /**
     * Generate braking curves overlay everywhere the mrsp decreases (increases backwards) with a
     * discontinuity using constant deceleration (outside ETCS ranges).
     */
    private fun addConstSlowdownBrakingCurves(
        context: EnvelopeSimContext,
        envelope: Envelope
    ): Envelope {
        val builder = OverlayEnvelopeBuilder.backward(envelope)
        val cursor = EnvelopeCursor.backward(envelope)
        var lastPosition = envelope.endPos
        while (cursor.findPartTransition(MaxSpeedEnvelope::increase)) {
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
                    EnvelopeConstraint(envelope, EnvelopePartConstraintType.CEILING)
                )
            val startSpeed = cursor.speed
            val startPosition = cursor.position
            // TODO: link directionSign to cursor boolean reverse
            EnvelopeDeceleration.decelerate(
                context,
                startPosition,
                startSpeed,
                overlayBuilder,
                -1.0
            )
            builder.addPart(partBuilder.build())
            cursor.nextPart()
            lastPosition = overlayBuilder.lastPos
        }
        return builder.build()
    }

    /** Add braking curves following ETCS rules in relevant places */
    private fun addETCSSlowdownBrakingCurves(
        etcsSimulator: ETCSBrakingSimulator,
        context: EnvelopeSimContext,
        envelope: Envelope
    ): Envelope {
        val etcsRanges = context.etcsContext?.applicationRanges ?: return envelope
        val cursor = EnvelopeCursor.backward(envelope)
        val limitsOfAuthority = mutableListOf<LimitOfAuthority>()
        while (cursor.findPartTransition(MaxSpeedEnvelope::increase)) {
            val offset = Offset<TravelledPath>(cursor.position.meters)
            if (etcsRanges.contains(offset.distance)) {
                limitsOfAuthority.add(
                    LimitOfAuthority(
                        offset,
                        cursor.speed,
                    )
                )
            }
            cursor.nextPart()
        }
        return etcsSimulator.addSlowdownBrakingCurves(envelope, limitsOfAuthority)
    }

    /** Generate braking curves overlay at every stop position */
    private fun addStopBrakingCurves(
        etcsSimulator: ETCSBrakingSimulator,
        context: EnvelopeSimContext,
        stopInfos: List<SimStopInfo>,
        curveWithDecelerations: Envelope
    ): Envelope {
        var envelope = curveWithDecelerations
        val stops = makeSimStops(context, stopInfos, envelope)
        envelope = addETCSStopBrakingCurves(etcsSimulator, context, envelope, stops)
        envelope = addConstStopBrakingCurves(context, envelope, stops)
        return envelope
    }

    /** Generate braking curves overlay at every stop position */
    private fun addConstStopBrakingCurves(
        context: EnvelopeSimContext,
        curveWithDecelerations: Envelope,
        stops: List<SimStop>,
    ): Envelope {
        var envelope = curveWithDecelerations
        for (stop in stops) {
            if (stop.isETCS) continue // Already handled
            val partBuilder = EnvelopePartBuilder()
            partBuilder.setAttr(EnvelopeProfile.BRAKING)
            val overlayBuilder =
                ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    SpeedConstraint(0.0, EnvelopePartConstraintType.FLOOR),
                    EnvelopeConstraint(envelope, EnvelopePartConstraintType.CEILING)
                )
            EnvelopeDeceleration.decelerate(context, stop.offset, 0.0, overlayBuilder, -1.0)

            val builder = OverlayEnvelopeBuilder.backward(envelope)
            builder.addPart(partBuilder.build())
            envelope = builder.build()
        }
        return envelope
    }

    /** Add braking parts for any ETCS flagged stop. */
    private fun addETCSStopBrakingCurves(
        simulator: ETCSBrakingSimulator,
        context: EnvelopeSimContext,
        envelope: Envelope,
        stops: List<SimStop>
    ): Envelope {
        val endsOfAuthority =
            stops
                .filter { it.isETCS }
                .map {
                    EndOfAuthority(
                        offsetEOA = Offset(it.offset.meters),
                        // On a closed signal, we follow the indication speed curve with an SVL at
                        // the next danger point to protect
                        // On an open signal, we follow the permitted speed curve with no SVL
                        offsetSVL =
                            if (it.rjsReceptionSignal.isStopOnClosedSignal())
                                getDangerPoint(context, it)
                            else null,
                        usedCurveType =
                            if (it.rjsReceptionSignal.isStopOnClosedSignal()) IND else PS
                    )
                }
        return simulator.addStopBrakingCurves(envelope, endsOfAuthority)
    }

    /**
     * Returns the SVL location: next buffer stop or switch, whichever is closest. If there is any.
     */
    private fun getDangerPoint(context: EnvelopeSimContext, stop: SimStop): Offset<TravelledPath>? {
        val etcsContext = context.etcsContext!!
        return etcsContext.dangerPointOffsets.firstOrNull { it.distance.meters >= stop.offset }
    }

    /**
     * Converts the raw double offsets into a data class with some metadata. Handles some of the
     * input checking (such as invalid offsets).
     */
    private fun makeSimStops(
        context: EnvelopeSimContext,
        stopInfos: List<SimStopInfo>,
        envelope: Envelope
    ): List<SimStop> {
        val res = mutableListOf<SimStop>()
        for ((i, stopInfo) in stopInfos.withIndex()) {
            val (stopOffset, isClosedSignal) = stopInfo
            if (stopOffset == 0.0) continue
            val isETCS =
                context.etcsContext?.applicationRanges?.contains(stopOffset.meters) ?: false
            var offset = stopOffset
            if (offset > envelope.endPos) {
                if (TrainPhysicsIntegrator.arePositionsEqual(offset, envelope.endPos))
                    offset = envelope.endPos
                else throw OSRDError.newEnvelopeError(i, offset, envelope.endPos)
            }
            res.add(SimStop(offset, isETCS, isClosedSignal))
        }
        return res
    }

    /** Generate a max speed envelope given a mrsp */
    @JvmStatic
    fun from(context: EnvelopeSimContext, stopInfos: List<SimStopInfo>, mrsp: Envelope): Envelope {
        val etcsSimulator = ETCSBrakingSimulatorImpl(context)
        var maxSpeedEnvelope = addSlowdownBrakingCurves(etcsSimulator, context, mrsp)
        maxSpeedEnvelope = addStopBrakingCurves(etcsSimulator, context, stopInfos, maxSpeedEnvelope)
        return maxSpeedEnvelope
    }
}
