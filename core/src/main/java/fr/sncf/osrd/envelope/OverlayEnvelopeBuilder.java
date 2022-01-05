package fr.sncf.osrd.envelope;

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
    /** Holds the current position inside the envelope */
    public final EnvelopeCursor cursor;

    /** The location of the end of the last overlay */
    private int lastOverlayEndPartIndex = -1;
    /** @see #lastOverlayEndPartIndex */
    private int lastOverlayEndStepIndex = -1;
    /** @see #lastOverlayEndPartIndex */
    private double lastOverlayEndPosition = Double.NaN;

    /** The result of the build */
    private EnvelopeBuilder builder;

    // region CONSTRUCTORS
    public OverlayEnvelopeBuilder(EnvelopeCursor cursor) {
        this.cursor = cursor;
        this.builder = new EnvelopeBuilder();
    }

    public static OverlayEnvelopeBuilder withDirection(Envelope base, boolean reverse) {
        return new OverlayEnvelopeBuilder(new EnvelopeCursor(base, reverse));
    }

    public static OverlayEnvelopeBuilder forward(Envelope base) {
        return new OverlayEnvelopeBuilder(new EnvelopeCursor(base, false));
    }

    public static OverlayEnvelopeBuilder backward(Envelope base) {
        return new OverlayEnvelopeBuilder(new EnvelopeCursor(base, true));
    }
    // endregion

    /** Starts an overlay at the given position and speed */
    public OverlayEnvelopePartBuilder startDiscontinuousOverlay(
            EnvelopePartMeta meta,
            double initialSpeed
    ) {
        return OverlayEnvelopePartBuilder.startDiscontinuousOverlay(cursor, meta, initialSpeed);
    }

    /** Starts an overlay at the given position, keeping the envelope continuous */
    public OverlayEnvelopePartBuilder startContinuousOverlay(EnvelopePartMeta meta) {
        return OverlayEnvelopePartBuilder.startContinuousOverlay(cursor, meta);
    }


    /** Add parts to the result, taking direction into account */
    private void addParts(EnvelopePart[] parts) {
        if (parts == null)
            return;

        if (cursor.reverse)
            for (int i = parts.length - 1; i >= 0; i--)
                builder.addPart(parts[i]);
        else
            for (var part : parts)
                builder.addPart(part);
    }

    private void sliceBaseEnvelope(int beginPartIndex, int beginStepIndex, double beginPosition) {
        addParts(cursor.smartSlice(
                lastOverlayEndPartIndex, lastOverlayEndStepIndex, lastOverlayEndPosition,
                beginPartIndex, beginStepIndex, beginPosition
        ));
    }

    /** Builds an overlay envelope part and adds it to the envelope */
    public void addPart(OverlayEnvelopePartBuilder partBuilder) {
        assert partBuilder.cursor == cursor;

        // ensure the cursor is at the end of the envelope part we're building
        // this is needed so we can efficiently slice the base envelope
        assert cursor.getPosition() == partBuilder.getLastPos();

        sliceBaseEnvelope(partBuilder.initialPartIndex, partBuilder.initialStepIndex, partBuilder.initialPosition);
        lastOverlayEndPartIndex = cursor.getPartIndex();
        lastOverlayEndStepIndex = cursor.getStepIndex();
        lastOverlayEndPosition = cursor.getPosition();
        builder.addPart(partBuilder.build());
    }

    /** Create the envelope */
    public Envelope build() {
        cursor.moveToEnd();
        sliceBaseEnvelope(-1, -1, Double.NaN);

        // build the final envelope
        if (cursor.reverse)
            builder.reverse();
        var result = builder.build();
        builder = null;
        return result;
    }
}
