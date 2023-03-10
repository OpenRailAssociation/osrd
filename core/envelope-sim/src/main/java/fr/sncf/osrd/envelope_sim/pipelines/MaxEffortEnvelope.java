package fr.sncf.osrd.envelope_sim.pipelines;

import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.*;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeCursor;
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder;
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.MaintainEnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint;
import fr.sncf.osrd.envelope.part.constraints.PositionConstraint;
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.ImpossibleSimulationError;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeAcceleration;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeMaintain;
import java.util.*;

/** Max effort envelope = Max speed envelope + acceleration curves + check maintain speed
 * It is the max physical speed at any given point, ignoring allowances */
public class MaxEffortEnvelope {
    /** Detects if an envelope parts is a plateau */
    public static boolean maxEffortPlateau(EnvelopePart part) {
        if (part.stepCount() != 1)
            return false;
        return part.getBeginSpeed() == part.getEndSpeed();
    }

    /** Generate acceleration curves overlay everywhere the max speed envelope increase with a discontinuity
     * and compute the constant speed parts to check if the train can physically maintain its speed or not */
    public static Envelope addAccelerationAndConstantSpeedParts(
            EnvelopeSimContext context,
            Envelope maxSpeedProfile,
            double initialSpeed
    ) {
        var builder = OverlayEnvelopeBuilder.forward(maxSpeedProfile);
        var cursor = EnvelopeCursor.forward(maxSpeedProfile);
        var maxSpeed = maxSpeedProfile.interpolateSpeedRightDir(0, 1);

        if (initialSpeed < maxSpeed) {
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

        while (!cursor.hasReachedEnd()){
            if (cursor.checkPart(MaxEffortEnvelope::maxEffortPlateau)){
                var partBuilder = new EnvelopePartBuilder();
                partBuilder.setAttr(EnvelopeProfile.CONSTANT_SPEED);

                var startSpeed = cursor.getStepBeginSpeed();
                var startPosition = cursor.getPosition();
                var overlayBuilder = new MaintainEnvelopePartBuilder(
                        partBuilder,
                        new SpeedConstraint(startSpeed, MAINTAIN_SPEED),
                        new SpeedConstraint(0, FLOOR),
                        new PositionConstraint(cursor.getPart().getBeginPos(), cursor.getPart().getEndPos())
                );
                EnvelopeMaintain.maintain(context, startPosition, startSpeed, overlayBuilder, 1);
                builder.addPart(partBuilder.build());
                cursor.findPosition(overlayBuilder.getLastPos());
            }
            else if (cursor.checkPartTransition(MaxSpeedEnvelope::increase)){
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
            else cursor.nextPart();
        }
        return builder.build();
    }

    /** Generate a max effort envelope given a max speed envelope */
    public static Envelope from(
            EnvelopeSimContext context,
            double initialSpeed,
            Envelope maxSpeedProfile
    ) {
        var maxEffortEnvelope = addAccelerationAndConstantSpeedParts(context, maxSpeedProfile, initialSpeed);
        if (!maxEffortEnvelope.continuous) {
            // Discontinuity can happen when the train stops because of high slopes
            throw new ImpossibleSimulationError();
        }
        assert maxEffortEnvelope.getBeginPos() == 0;
        return maxEffortEnvelope;
    }
}
