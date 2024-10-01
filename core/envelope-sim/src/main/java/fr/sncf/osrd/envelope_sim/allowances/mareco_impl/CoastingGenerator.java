package fr.sncf.osrd.envelope_sim.allowances.mareco_impl;

import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.CEILING;
import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.FLOOR;
import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.areSpeedsEqual;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint;
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint;
import fr.sncf.osrd.envelope_sim.*;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeCoasting;

public final class CoastingGenerator {
    /** Generate a coasting envelope part which starts at startPos */
    public static EnvelopePart coastFromBeginning(
            Envelope envelope, EnvelopeSimContext context, double startPos, double startSpeed) {
        var partBuilder = new EnvelopePartBuilder();
        partBuilder.setAttr(EnvelopeProfile.COASTING);
        var constrainedBuilder = new ConstrainedEnvelopePartBuilder(
                partBuilder, new SpeedConstraint(0, FLOOR), new EnvelopeConstraint(envelope, CEILING));
        EnvelopeCoasting.coast(context, startPos, startSpeed, constrainedBuilder, 1);
        if (constrainedBuilder.lastIntersection == 0) {
            // We reached a stop while coasting. This is not supposed to normally happen,
            // but may be the result of the coasting envelope not intersecting with the
            // base envelope (such as being an epsilon away before diverging again).
            // We can't properly handle it without editing envelopes by hand,
            // but returning null can keep the binary search going.
            return null;
        }
        if (partBuilder.isEmpty()) return null;
        return partBuilder.build();
    }

    /** Generate a coasting envelope part which ends at endPos and never goes below lowSpeedLimit */
    public static EnvelopePart coastFromEnd(
            Envelope envelope, EnvelopeSimContext context, double endPos, double lowSpeedLimit) {
        assert endPos >= 0 && endPos <= context.path.getLength();

        // coast backwards from the end position until the base curve is met
        var backwardPartBuilder = new EnvelopePartBuilder();
        backwardPartBuilder.setAttr(EnvelopeProfile.COASTING);
        var constrainedBuilder = new ConstrainedEnvelopePartBuilder(
                backwardPartBuilder, new SpeedConstraint(0, FLOOR), new EnvelopeConstraint(envelope, CEILING));

        double position = endPos;
        double speed = envelope.interpolateSpeed(position);
        assert speed >= lowSpeedLimit || areSpeedsEqual(speed, lowSpeedLimit) : "start coasting below min speed";
        var initInter = constrainedBuilder.initEnvelopePart(position, speed, -1);
        assert initInter;
        boolean reachedLowLimit = false;
        while (true) {
            var step = TrainPhysicsIntegrator.step(context, position, speed, Action.COAST, -1);
            position += step.positionDelta;
            speed = step.endSpeed;
            if (!areSpeedsEqual(speed, lowSpeedLimit) && speed < lowSpeedLimit) {
                speed = lowSpeedLimit;
                reachedLowLimit = true;
            }

            if (!constrainedBuilder.addStep(position, speed, step.timeDelta)) break;
        }

        if (backwardPartBuilder.isEmpty()) return null;

        assert constrainedBuilder.getLastPos() < endPos;

        if (!reachedLowLimit && constrainedBuilder.getLastPos() != envelope.getBeginPos())
            return backwardPartBuilder.build();

        var resultCoast = coastFromBeginning(
                envelope, context, constrainedBuilder.getLastPos(), constrainedBuilder.getLastSpeed());
        if (resultCoast == null || resultCoast.getEndPos() > endPos + context.timeStep * speed) {
            // The coasting envelope didn't intersect with the base envelope,
            // which can happen if it should have intersected in the middle of a simulation step.
            // There's no good way to handle this with the current envelope framework,
            // returning null at least avoids crashing and keeps the binary search going
            System.out.println("weird behavior there");
            return null;
        }
        return resultCoast;
    }
}
