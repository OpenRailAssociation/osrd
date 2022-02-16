package fr.sncf.osrd.envelope;

import fr.sncf.osrd.utils.CmpOperator;

public class EnvelopeSpeedCap {
    /** Adds a global speed limit to an envelope */
    public static Envelope from(Envelope base, EnvelopePartMeta meta, double speedLimit) {
        var cursor = new EnvelopeCursor(base, false);
        var builder = OverlayEnvelopeBuilder.forward(base);
        while (cursor.findSpeed(speedLimit, CmpOperator.STRICTLY_HIGHER)) {
            var partBuilder = OverlayEnvelopePartBuilder.startDiscontinuousOverlay(cursor, meta, speedLimit);
            partBuilder.addPlateau();
            builder.addPart(partBuilder.build());
        }
        var res = builder.build();
        assert !base.continuous || res.continuous;
        return res;
    }
}
