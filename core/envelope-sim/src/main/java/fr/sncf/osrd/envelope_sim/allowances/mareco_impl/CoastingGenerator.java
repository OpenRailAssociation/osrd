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
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;

public final class CoastingGenerator {
    /** Generate a coasting envelope part which starts at startPos */
    public static EnvelopePart coastFromBeginning(
            Envelope envelope,
            EnvelopeSimContext context,
            double startPos,
            double startSpeed
    ) {
        var partBuilder = new EnvelopePartBuilder();
        partBuilder.setAttr(EnvelopeProfile.COASTING);
        var constrainedBuilder = new ConstrainedEnvelopePartBuilder(
                partBuilder,
                new SpeedConstraint(0, FLOOR),
                new EnvelopeConstraint(envelope, CEILING)
        );
        EnvelopeCoasting.coast(context, startPos, startSpeed, constrainedBuilder, 1);
        if (constrainedBuilder.lastIntersection == 0)
            throw new OSRDError(ErrorType.ImpossibleSimulationError); // We reached a stop while coasting
        if (partBuilder.isEmpty())
            return null;
        return partBuilder.build();
    }

    /** Generate a coasting envelope part which ends at endPos and never goes below lowSpeedLimit */
    public static EnvelopePart coastFromEnd(
            Envelope envelope,
            EnvelopeSimContext context,
            double endPos,
            double lowSpeedLimit
    ) {
        assert endPos >= 0 && endPos <= context.path.getLength();

        // Lower values can often cause many float-related errors when the speed gets too close to 0
        lowSpeedLimit = Math.max(1, lowSpeedLimit);

        // coast backwards from the end position until the base curve is met
        var backwardPartBuilder = new EnvelopePartBuilder();
        backwardPartBuilder.setAttr(EnvelopeProfile.COASTING);
        var constrainedBuilder = new ConstrainedEnvelopePartBuilder(
                backwardPartBuilder,
                new SpeedConstraint(0, FLOOR),
                new EnvelopeConstraint(envelope, CEILING)
        );

        double position = endPos;
        double speed = envelope.interpolateSpeed(position);
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

            if (!constrainedBuilder.addStep(position, speed, step.timeDelta))
                break;
        }

        if (backwardPartBuilder.isEmpty())
            return null;

        assert constrainedBuilder.getLastPos() < endPos;

        if (!reachedLowLimit && constrainedBuilder.getLastPos() != envelope.getBeginPos())
            return backwardPartBuilder.build();

        var resultCoast = coastFromBeginning(envelope, context, constrainedBuilder.getLastPos(),
                constrainedBuilder.getLastSpeed());
        assert resultCoast == null || resultCoast.getEndPos() <= endPos + context.timeStep * speed;
        return resultCoast;
    }
}
