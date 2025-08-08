package fr.sncf.osrd.envelope_sim.pipelines

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeCursor
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType
import fr.sncf.osrd.envelope.part.constraints.PositionConstraint
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeAcceleration
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeMaintain
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import kotlin.math.max
import kotlin.math.min

/**
 * Max effort envelope = Max speed envelope + acceleration curves + check maintain speed It is the
 * max physical speed at any given point, ignoring allowances
 */

/** Detects if an envelope parts is a plateau */
fun maxEffortPlateau(part: EnvelopePart): Boolean {
    return part.minSpeed == part.maxSpeed
}

/**
 * Generate acceleration curves overlay everywhere the max speed envelope increase with a
 * discontinuity and compute the constant speed parts to check whether the train can physically
 * maintain its speed
 */
fun addAccelerationAndConstantSpeedParts(
    context: EnvelopeSimContext,
    maxSpeedProfile: Envelope,
    initialPosition: Double,
    initialSpeed: Double,
): Envelope {
    val builder = OverlayEnvelopeBuilder.forward(maxSpeedProfile)
    val cursor = EnvelopeCursor.forward(maxSpeedProfile)
    val maxSpeed = maxSpeedProfile.interpolateSpeedRightDir(initialPosition, 1.0)
    if (initialSpeed < maxSpeed) {
        accelerate(context, maxSpeedProfile, initialSpeed, initialPosition, builder, cursor)
    }
    while (!cursor.hasReachedEnd()) {
        if (cursor.checkPart(::maxEffortPlateau)) {
            var partBuilder = EnvelopePartBuilder()
            partBuilder.setAttr<EnvelopeProfile>(EnvelopeProfile.CONSTANT_SPEED)
            var startSpeed = cursor.stepBeginSpeed
            var startPosition = cursor.getPosition()
            var overlayBuilder =
                ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    SpeedConstraint(startSpeed, EnvelopePartConstraintType.EQUAL),
                    PositionConstraint(cursor.getPart().beginPos, cursor.getPart().endPos),
                )
            EnvelopeMaintain.maintain(context, startPosition, startSpeed, overlayBuilder, 1.0)

            // check if the speed can be maintained from the first position before adding the
            // part,
            // otherwise it would only be a single point
            if (partBuilder.stepCount() > 1) {
                builder.addPart(partBuilder.build())
                cursor.findPosition(overlayBuilder.lastPos)
            }

            // if the cursor didn't reach the end of the constant speed part,
            // that means the train was slowed down by a steep ramp
            if (cursor.getPosition() < cursor.getPart().endPos) {
                partBuilder = EnvelopePartBuilder()
                partBuilder.setAttr<EnvelopeProfile>(EnvelopeProfile.CATCHING_UP)
                overlayBuilder =
                    ConstrainedEnvelopePartBuilder(
                        partBuilder,
                        SpeedConstraint(0.0, EnvelopePartConstraintType.FLOOR),
                        EnvelopeConstraint(maxSpeedProfile, EnvelopePartConstraintType.CEILING),
                    )
                startPosition = cursor.getPosition()
                startSpeed = maxSpeedProfile.interpolateSpeedLeftDir(startPosition, 1.0)
                EnvelopeAcceleration.accelerate(
                    context,
                    startPosition,
                    startSpeed,
                    overlayBuilder,
                    1.0,
                )
                cursor.findPosition(overlayBuilder.lastPos)

                if (overlayBuilder.lastIntersection == 0) {
                    // Train stopped while trying to catch up
                    throw OSRDError(ErrorType.ImpossibleSimulationError)
                }

                // check that the train was actually slowed down by the ramp
                if (partBuilder.stepCount() > 0) // if the part has more than one point, add it
                 builder.addPart(partBuilder.build())
                else {
                    // otherwise skip this position as the train isn't really being slowed down
                    // and step 1m further
                    val maxPosition =
                        cursor.getPart().endPos // We don't want to skip further than the part
                    if (cursor.getPosition() < maxPosition)
                        cursor.findPosition(min(maxPosition, cursor.getPosition() + 1))
                }
            }
        } else if (cursor.checkPartTransition(::increase)) {
            val startSpeed = maxSpeedProfile.interpolateSpeedLeftDir(cursor.getPosition(), 1.0)
            accelerate(context, maxSpeedProfile, startSpeed, cursor.getPosition(), builder, cursor)
        } else cursor.nextPart()
    }
    return builder.build()
}

/**
 * Accelerates starting at the given speed and position. Simple code factorization, it's called when
 * starting up and at part transitions.
 */
private fun accelerate(
    context: EnvelopeSimContext,
    maxSpeedProfile: Envelope,
    initialSpeed: Double,
    startPosition: Double,
    builder: OverlayEnvelopeBuilder,
    cursor: EnvelopeCursor,
) {
    val partBuilder = EnvelopePartBuilder()
    partBuilder.setAttr<EnvelopeProfile>(EnvelopeProfile.ACCELERATING)
    val overlayBuilder =
        ConstrainedEnvelopePartBuilder(
            partBuilder,
            SpeedConstraint(0.0, EnvelopePartConstraintType.FLOOR),
            EnvelopeConstraint(maxSpeedProfile, EnvelopePartConstraintType.CEILING),
        )
    EnvelopeAcceleration.accelerate(context, startPosition, initialSpeed, overlayBuilder, 1.0)
    cursor.findPosition(overlayBuilder.lastPos)
    if (overlayBuilder.lastIntersection == 0) {
        // The train stopped before reaching the end
        val err = OSRDError(ErrorType.ImpossibleSimulationError)
        val offset = cursor.getPosition()
        err.context.put("offset", String.format("%.0fm", offset))
        val headPosition = min(max(0.0, offset), context.path.length)
        val tailPosition =
            min(max(0.0, headPosition - context.rollingStock.getLength()), context.path.length)
        val grade = context.path.getAverageGrade(headPosition, tailPosition)
        err.context.put("grade", String.format("%.2fm/km", grade))
        val map = context.tractiveEffortCurveMap[cursor.getPosition()]!!
        err.context.put("traction_force", String.format("%.2fN", map[0].maxEffort))
        throw err
    }
    builder.addPart(partBuilder.build())
}

/** Generate a max effort envelope given a max speed envelope */
fun maxEffortEnvelopeFrom(
    context: EnvelopeSimContext,
    initialSpeed: Double,
    maxSpeedProfile: Envelope,
): Envelope {
    val maxEffortEnvelope =
        addAccelerationAndConstantSpeedParts(context, maxSpeedProfile, 0.0, initialSpeed)
    assert(maxEffortEnvelope.continuous) { "Discontinuity in max effort envelope" }
    assert(maxEffortEnvelope.beginPos == 0.0)
    return maxEffortEnvelope
}
