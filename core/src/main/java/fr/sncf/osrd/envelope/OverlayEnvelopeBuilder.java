package fr.sncf.osrd.envelope;

import java.util.ArrayDeque;

/**
 * <p>Creates an overlay over an envelope by combining slices of the base envelope and overlay envelope parts</p>
 * <pre>
 *     Envelope testEnvelope = ...;
 *     var cursor = EnvelopeCursor.forward(testEnvelope);
 *     var builder = new OverlayEnvelopeBuilder(cursor);
 *     cursor.findPosition(42.0);
 *     var partBuilder = builder.startContinuous(null);
 *     while (partBuilder.addStep(...)) {
 *         ...
 *     }
 *     builder.addPart(partBuilder);
 *     builder.build();
 * </pre>
 */
public final class OverlayEnvelopeBuilder {
    public final Envelope base;
    public final boolean reverse;
    private final ArrayDeque<EnvelopePart> overlayParts;

    // region CONSTRUCTORS
    private OverlayEnvelopeBuilder(Envelope base, boolean reverse) {
        this.base = base;
        this.reverse = reverse;
        this.overlayParts = new ArrayDeque<>();
    }

    public static OverlayEnvelopeBuilder withDirection(Envelope base, boolean reverse) {
        return new OverlayEnvelopeBuilder(base, reverse);
    }

    public static OverlayEnvelopeBuilder forward(Envelope base) {
        return new OverlayEnvelopeBuilder(base, false);
    }

    public static OverlayEnvelopeBuilder backward(Envelope base) {
        return new OverlayEnvelopeBuilder(base, true);
    }
    // endregion

    /** Adds an overlay envelope part to the builder */
    public void addPart(EnvelopePart part) {
        if (reverse) {
            assert overlayParts.isEmpty() || part.getEndPos() <= overlayParts.getFirst().getBeginPos();
            overlayParts.addFirst(part);
        } else {
            assert overlayParts.isEmpty() || overlayParts.getLast().getEndPos() <= part.getBeginPos();
            overlayParts.addLast(part);
        }
    }

    /** Slice the base curve between the end of the previous overlay and the beginning of the current one. */
    private EnvelopePart[] sliceBase(
            EnvelopePart previousOverlay,
            EnvelopePart currentOverlay
    ) {
        double sliceBeginPos = Double.NEGATIVE_INFINITY;
        double sliceBeginSpeed = Double.NaN;
        if (previousOverlay != null) {
            sliceBeginPos = previousOverlay.getEndPos();
            int partIndex = base.findRight(sliceBeginPos);
            var baseSpeed = base.get(partIndex).interpolateSpeed(sliceBeginPos);
            if (Math.abs(baseSpeed - previousOverlay.getEndSpeed()) < 1e-6)
                sliceBeginSpeed = previousOverlay.getEndSpeed();
        }
        double sliceEndPos = Double.POSITIVE_INFINITY;
        double sliceEndSpeed = Double.NaN;
        if (currentOverlay != null) {
            sliceEndPos = currentOverlay.getBeginPos();
            int partIndex = base.findLeft(sliceEndPos);
            var baseSpeed = base.get(partIndex).interpolateSpeed(sliceEndPos);
            if (Math.abs(baseSpeed - currentOverlay.getBeginSpeed()) < 1e-6)
                sliceEndSpeed = currentOverlay.getBeginSpeed();
        }
        return base.slice(sliceBeginPos, sliceBeginSpeed, sliceEndPos, sliceEndSpeed);
    }

    /** Create the envelope */
    public Envelope build() {
        // build the final envelope
        var builder = new EnvelopeBuilder();

        EnvelopePart previousOverlay = null;
        for (var overlayPart : overlayParts) {
            builder.addParts(sliceBase(previousOverlay, overlayPart));
            builder.addPart(overlayPart);
            previousOverlay = overlayPart;
        }

        builder.addParts(sliceBase(previousOverlay, null));
        return builder.build();
    }
}
