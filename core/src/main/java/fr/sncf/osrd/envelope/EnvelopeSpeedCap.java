package fr.sncf.osrd.envelope;

import fr.sncf.osrd.utils.CompareSign;

public class EnvelopeSpeedCap {
    /** Adds a global speed limit to an envelope */
    public static Envelope from(Envelope base, EnvelopePartMeta meta, double speedLimit) {
        var cursor = new EnvelopeCursor(base, false);
        var builder = new OverlayEnvelopeBuilder(cursor);
        while (cursor.findSpeed(speedLimit, CompareSign.HIGHER)) {
            var partBuilder = builder.startDiscontinuousOverlay(meta, speedLimit);
            partBuilder.addPlateau();
            builder.addPart(partBuilder);
        }
        return builder.build();
    }
}
