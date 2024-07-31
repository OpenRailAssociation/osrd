package fr.sncf.osrd.envelope;

import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import fr.sncf.osrd.envelope_utils.CmpOperator;
import fr.sncf.osrd.utils.SelfTypeHolder;
import java.util.Collection;
import java.util.HashSet;

public class EnvelopeSpeedCap {
    /** Adds a global speed limit to an envelope */
    public static Envelope from(Envelope base, Collection<SelfTypeHolder> attrs, double speedLimit) {
        var cursor = new EnvelopeCursor(base, false);
        var builder = OverlayEnvelopeBuilder.forward(base);
        var SelfTypeHolders = new HashSet<>(attrs);
        SelfTypeHolders.add(EnvelopeProfile.CONSTANT_SPEED);
        while (cursor.findSpeed(speedLimit, CmpOperator.STRICTLY_HIGHER)) {
            var startPos = cursor.getPosition();

            var partBuilder = new EnvelopePartBuilder();
            partBuilder.setAttrs(SelfTypeHolders);
            partBuilder.initEnvelopePart(startPos, speedLimit, 1);

            var hasNotReachedEnd = cursor.findSpeed(speedLimit, CmpOperator.STRICTLY_LOWER);
            assert hasNotReachedEnd != cursor.hasReachedEnd();
            double endPosition;
            if (hasNotReachedEnd) endPosition = cursor.getPosition();
            else endPosition = cursor.getEnvelopeEndPos();

            var plateauLength = Math.abs(endPosition - startPos);
            var plateauDuration = plateauLength / speedLimit;
            partBuilder.addStep(endPosition, speedLimit, plateauDuration);
            cursor.findPosition(endPosition);
            builder.addPart(partBuilder.build());
        }
        var res = builder.build();
        assert !base.continuous || res.continuous;
        return res;
    }
}
