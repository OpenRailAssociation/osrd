package fr.sncf.osrd.envelope_sim.allowances.mareco_impl

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint
import fr.sncf.osrd.envelope_sim.Action
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeCoasting
import fr.sncf.osrd.utils.areSpeedsEqual

object CoastingGenerator {
    /** Generate a coasting envelope part which starts at startPos */
    fun coastFromBeginning(
        envelope: Envelope,
        context: EnvelopeSimContext,
        startPos: Double,
        startSpeed: Double,
    ): EnvelopePart? {
        val partBuilder = EnvelopePartBuilder()
        partBuilder.setAttr(EnvelopeProfile.COASTING)
        val constrainedBuilder =
            ConstrainedEnvelopePartBuilder(
                partBuilder,
                SpeedConstraint(0.0, EnvelopePartConstraintType.FLOOR),
                EnvelopeConstraint(envelope, EnvelopePartConstraintType.CEILING),
            )
        EnvelopeCoasting.coast(context, startPos, startSpeed, constrainedBuilder, 1.0)
        if (constrainedBuilder.lastIntersection == 0) {
            // We reached a stop while coasting. This is not supposed to normally happen,
            // but may be the result of the coasting envelope not intersecting with the
            // base envelope (such as being an epsilon away before diverging again).
            // We can't properly handle it without editing envelopes by hand,
            // but returning null can keep the binary search going.
            return null
        }
        if (partBuilder.isEmpty) return null
        return partBuilder.build()
    }

    /** Generate a coasting envelope part which ends at endPos and never goes below lowSpeedLimit */
    fun coastFromEnd(
        envelope: Envelope,
        context: EnvelopeSimContext,
        endPos: Double,
        lowSpeedLimit: Double,
    ): EnvelopePart? {
        assert(endPos >= 0 && endPos <= context.path.length)

        // coast backwards from the end position until the base curve is met
        val backwardPartBuilder = EnvelopePartBuilder()
        backwardPartBuilder.setAttr(EnvelopeProfile.COASTING)
        val constrainedBuilder =
            ConstrainedEnvelopePartBuilder(
                backwardPartBuilder,
                SpeedConstraint(0.0, EnvelopePartConstraintType.FLOOR),
                EnvelopeConstraint(envelope, EnvelopePartConstraintType.CEILING),
            )

        var position = endPos
        var speed = envelope.interpolateSpeed(position)
        assert(speed >= lowSpeedLimit || areSpeedsEqual(speed, lowSpeedLimit)) {
            "start coasting below min speed"
        }
        val initInter = constrainedBuilder.initEnvelopePart(position, speed, -1.0)
        assert(initInter)
        var reachedLowLimit = false
        while (true) {
            val step = TrainPhysicsIntegrator.step(context, position, speed, Action.COAST, -1.0)
            position += step.positionDelta
            speed = step.endSpeed
            if (!areSpeedsEqual(speed, lowSpeedLimit) && speed < lowSpeedLimit) {
                speed = lowSpeedLimit
                reachedLowLimit = true
            }

            if (!constrainedBuilder.addStep(position, speed, step.timeDelta)) break
        }

        if (backwardPartBuilder.isEmpty) return null

        assert(constrainedBuilder.lastPos < endPos)

        if (!reachedLowLimit) {
            return backwardPartBuilder.build()
            // We only need to recompute a coasting going forward if the low speed limit has been
            // reached,
            // as we'd need to add accelerations in places where we've clipped the speed
        }

        val resultCoast =
            coastFromBeginning(
                envelope,
                context,
                constrainedBuilder.lastPos,
                constrainedBuilder.lastSpeed,
            )
        if (resultCoast == null || resultCoast.endPos > endPos + context.timeStep * speed) {
            // The coasting envelope didn't intersect with the base envelope,
            // which can happen if it should have intersected in the middle of a simulation step.
            // There's no good way to handle this with the current envelope framework,
            // returning null at least avoids crashing and keeps the binary search going
            return null
        }
        return resultCoast
    }
}
