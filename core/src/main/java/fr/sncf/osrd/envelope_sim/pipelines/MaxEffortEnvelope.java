package fr.sncf.osrd.envelope_sim.pipelines;

import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.CEILING;
import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.FLOOR;

import fr.sncf.osrd.envelope.*;
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint;
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeAcceleration;

/** Max effort envelope = Max speed envelope + acceleration curves + check maintain speed
 * It is the max physical speed at any given point, ignoring allowances */
public class MaxEffortEnvelope {
    /** Detects if an envelope parts is a plateau */
    public static boolean maxEffortPlateau(EnvelopePart part) {
        if (part.stepCount() != 1)
            return false;
        return part.getBeginSpeed() == part.getEndSpeed();
    }

    /** Generate acceleration curves overlay everywhere the max speed envelope increase with a discontinuity */
    public static Envelope addAccelerationCurves(
            EnvelopeSimContext context,
            Envelope maxSpeedProfile,
            double initialSpeed
    ) {
        var builder = OverlayEnvelopeBuilder.forward(maxSpeedProfile);
        var cursor = EnvelopeCursor.forward(maxSpeedProfile);
        {
            var partBuilder = new EnvelopePartBuilder();
            partBuilder.setAttr(EnvelopeProfile.ACCELERATING);
            var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    new SpeedConstraint(0, FLOOR),
                    new EnvelopeConstraint(maxSpeedProfile, CEILING)
            );
            EnvelopeAcceleration.accelerate(context, 0, initialSpeed, overlayBuilder, 1);
            cursor.findPosition(overlayBuilder.getLastPos());
            builder.addPart(partBuilder.build());
        }
        while (cursor.findPartTransition(MaxSpeedEnvelope::increase)) {
            var partBuilder = new EnvelopePartBuilder();
            partBuilder.setAttr(EnvelopeProfile.ACCELERATING);
            var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    new SpeedConstraint(0, FLOOR),
                    new EnvelopeConstraint(maxSpeedProfile, CEILING)
            );
            var startSpeed = maxSpeedProfile.interpolateSpeedLeftDir(cursor.getPosition(), 1);
            var startPosition = cursor.getPosition();
            EnvelopeAcceleration.accelerate(context, startPosition, startSpeed, overlayBuilder, 1);
            cursor.findPosition(overlayBuilder.getLastPos());
            builder.addPart(partBuilder.build());
        }
        return builder.build();
    }

    /** Generate overlays everywhere the train cannot physically maintain the target speed */
    public static Envelope addMaintainSpeedCurves(
            EnvelopeSimContext context,
            Envelope maxSpeedProfile
    ) {
        var rollingStock = context.rollingStock;
        var path = context.path;
        var builder = OverlayEnvelopeBuilder.forward(maxSpeedProfile);
        var cursor = EnvelopeCursor.forward(maxSpeedProfile);
        while (cursor.findPart(MaxEffortEnvelope::maxEffortPlateau)) {
            double speed = cursor.getStepBeginSpeed();
            double maxTractionForce = rollingStock.getMaxEffort(speed);
            double rollingResistance = rollingStock.getRollingResistance(speed);
            double inertia = rollingStock.getInertia();
            double worstRamp = Math.asin((maxTractionForce - rollingResistance) / inertia / 9.81) * 1000;
            var envelopePart = cursor.getPart();
            while (cursor.getPart() == envelopePart) {
                double highRampPosition = path.findHighGradePosition(
                        cursor.getPosition(), envelopePart.getEndPos(), rollingStock.getLength(), worstRamp);
                cursor.findPosition(highRampPosition);
                if (cursor.getPosition() == envelopePart.getEndPos())
                    break;

                var partBuilder = new EnvelopePartBuilder();
                partBuilder.setAttr(EnvelopeProfile.CATCHING_UP);
                var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                        partBuilder,
                        new SpeedConstraint(0, FLOOR),
                        new EnvelopeConstraint(maxSpeedProfile, CEILING)
                );
                var startPosition = cursor.getPosition();
                var startSpeed = maxSpeedProfile.interpolateSpeedLeftDir(startPosition, 1);
                EnvelopeAcceleration.accelerate(context, startPosition, startSpeed, overlayBuilder, 1);
                cursor.findPosition(overlayBuilder.getLastPos());

                // Check that the high grade position can't be maintained
                if (partBuilder.stepCount() > 1)
                    builder.addPart(partBuilder.build());
                else
                    cursor.findPosition(cursor.getPosition()  + 1);
            }
            cursor.nextPart();
        }
        return builder.build();
    }

    /** Generate a max effort envelope given a max speed envelope */
    public static Envelope from(
            EnvelopeSimContext context,
            double initialSpeed,
            Envelope maxSpeedProfile
    ) {
        var maxEffortEnvelope = addAccelerationCurves(context, maxSpeedProfile, initialSpeed);
        maxEffortEnvelope = addMaintainSpeedCurves(context, maxEffortEnvelope);
        assert maxEffortEnvelope.continuous;
        assert maxEffortEnvelope.getBeginPos() == 0;
        return maxEffortEnvelope;
    }
}
