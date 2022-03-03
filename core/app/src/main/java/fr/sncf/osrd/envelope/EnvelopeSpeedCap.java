package fr.sncf.osrd.envelope;

import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import fr.sncf.osrd.utils.CmpOperator;

public class EnvelopeSpeedCap {
    /** Adds a global speed limit to an envelope */
    public static Envelope from(
            Envelope base,
            Iterable<EnvelopeAttr> attrs,
            double speedLimit
    ) {
        var cursor = new EnvelopeCursor(base, false);
        var builder = OverlayEnvelopeBuilder.forward(base);
        while (cursor.findSpeed(speedLimit, CmpOperator.STRICTLY_HIGHER)) {
            var startPos = cursor.getPosition();

            var partBuilder = new EnvelopePartBuilder();
            partBuilder.setAttrs(attrs);
            partBuilder.initEnvelopePart(startPos, speedLimit, 1);

            var hasNotReachedEnd = cursor.findSpeed(speedLimit, CmpOperator.STRICTLY_LOWER);
            assert hasNotReachedEnd != cursor.hasReachedEnd();
            double endPosition;
            if (hasNotReachedEnd)
                endPosition = cursor.getPosition();
            else
                endPosition = cursor.getEnvelopeEndPos();

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
