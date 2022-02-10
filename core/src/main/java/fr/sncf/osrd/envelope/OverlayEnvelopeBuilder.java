package fr.sncf.osrd.envelope;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.utils.CmpOperator;

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
    /** @see #lastOverlayEndPartIndex */
    private double lastOverlayEndSpeed = Double.NaN;

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

    /** Starts an overlay at the given position, speed and threshold */
    public OverlayEnvelopePartBuilder startDiscontinuousOverlay(
            EnvelopePartMeta meta,
            double initialSpeed,
            double threshold,
            CmpOperator cmpOperator
    ) {
        return OverlayEnvelopePartBuilder.startDiscontinuousOverlay(cursor, meta, initialSpeed, threshold, cmpOperator);
    }

    /** Starts an overlay at the given position and speed */
    public OverlayEnvelopePartBuilder startDiscontinuousOverlay(
            EnvelopePartMeta meta,
            double initialSpeed
    ) {
        return OverlayEnvelopePartBuilder.startDiscontinuousOverlay(cursor, meta, initialSpeed);
    }

    /** Starts an overlay at the given position and speed threshold, keeping the envelope continuous */
    public OverlayEnvelopePartBuilder startContinuousOverlay(
            EnvelopePartMeta meta,
            double speedThreshold,
            CmpOperator cmpOperator
    ) {
        return OverlayEnvelopePartBuilder.startContinuousOverlay(cursor, meta, speedThreshold, cmpOperator);
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

    /** Slices the base envelope from the end of the previous overlay to the beginning of current new one,
     * and adds the resulting envelope parts to the result.
     * If beginPartIndex is -1, the base envelope is sliced until the end.
     */
    private void sliceBaseEnvelope(int beginPartIndex, int beginStepIndex, double beginPosition, double beginSpeed) {
        addParts(cursor.smartSlice(
                lastOverlayEndPartIndex, lastOverlayEndStepIndex, lastOverlayEndPosition, lastOverlayEndSpeed,
                beginPartIndex, beginStepIndex, beginPosition, beginSpeed
        ));
    }

    /** Takes an overlay envelope part builder, builds it and adds it to the envelope */
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public void addPart(OverlayEnvelopePartBuilder partBuilder) {
        assert partBuilder.cursor == cursor;

        sliceBaseEnvelope(
                partBuilder.startPartIndex, partBuilder.startStepIndex,
                partBuilder.startPosition, partBuilder.startSpeed
        );

        // ensure the cursor is at the end of the envelope part we're building
        // this is needed so we can efficiently slice the base envelope

        if (cursor.hasReachedEnd()) {
            lastOverlayEndPartIndex = cursor.getEnvelopeLastPartIndex();
            lastOverlayEndStepIndex = cursor.getEnvelopeLastStepIndex();
            lastOverlayEndPosition = cursor.getEnvelopeEndPos();
            lastOverlayEndSpeed = cursor.getEnvelopeEndSpeed();
        } else {
            lastOverlayEndPartIndex = cursor.getPartIndex();
            lastOverlayEndStepIndex = cursor.getStepIndex();
            lastOverlayEndPosition = cursor.getPosition();
            lastOverlayEndSpeed = cursor.getSpeed();
        }

        assert lastOverlayEndPosition == partBuilder.getLastPos();
        builder.addPart(partBuilder.build());
    }

    /** Create the envelope */
    public Envelope build() {
        cursor.moveToEnd();
        sliceBaseEnvelope(-1, -1, Double.NaN, Double.NaN);

        // build the final envelope
        if (cursor.reverse)
            builder.reverse();
        var result = builder.build();
        builder = null;
        return result;
    }
}
