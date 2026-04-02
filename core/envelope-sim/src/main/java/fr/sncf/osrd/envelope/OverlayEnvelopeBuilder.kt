package fr.sncf.osrd.envelope

import fr.sncf.osrd.envelope.part.EnvelopePart
import java.util.*
import kotlin.math.abs

/**
 * Creates an overlay over an envelope by combining slices of the base envelope and overlay envelope
 * parts
 * <pre>
 * Envelope testEnvelope = ...;
 * var cursor = EnvelopeCursor.forward(testEnvelope);
 * var builder = new OverlayEnvelopeBuilder(cursor);
 * cursor.findPosition(42.0);
 * var partBuilder = builder.startContinuous(null);
 * while (partBuilder.addStep(...)) {
 * ...
 * }
 * builder.addPart(partBuilder);
 * builder.build();
 * </pre> *
 */
class OverlayEnvelopeBuilder private constructor(val base: Envelope, val reverse: Boolean) {
    private val overlayParts: ArrayDeque<EnvelopePart> = ArrayDeque<EnvelopePart>()

    /** Adds an overlay envelope part to the builder */
    fun addPart(part: EnvelopePart) {
        if (reverse) {
            assert(overlayParts.isEmpty() || part.endPos <= overlayParts.getFirst().beginPos)
            overlayParts.addFirst(part)
        } else {
            assert(overlayParts.isEmpty() || overlayParts.getLast().endPos <= part.beginPos)
            overlayParts.addLast(part)
        }
    }

    /**
     * Slice the base curve between the end of the previous overlay and the beginning of the current
     * one.
     */
    private fun sliceBase(
        previousOverlay: EnvelopePart?,
        currentOverlay: EnvelopePart?,
    ): Array<EnvelopePart> {
        var sliceBeginPos = Double.NEGATIVE_INFINITY
        var sliceBeginSpeed = Double.NaN
        if (previousOverlay != null) {
            sliceBeginPos = previousOverlay.endPos
            val partIndex = base.findRight(sliceBeginPos)
            val baseSpeed = base.get(partIndex).interpolateSpeed(sliceBeginPos)
            if (abs(baseSpeed - previousOverlay.endSpeed) < 1e-6)
                sliceBeginSpeed = previousOverlay.endSpeed
        }
        var sliceEndPos = Double.POSITIVE_INFINITY
        var sliceEndSpeed = Double.NaN
        if (currentOverlay != null) {
            sliceEndPos = currentOverlay.beginPos
            val partIndex = base.findLeft(sliceEndPos)
            val baseSpeed = base.get(partIndex).interpolateSpeed(sliceEndPos)
            if (abs(baseSpeed - currentOverlay.beginSpeed) < 1e-6)
                sliceEndSpeed = currentOverlay.beginSpeed
        }
        if (sliceBeginPos == sliceEndPos) return arrayOf() // Prevents 0-length parts

        return base.slice(sliceBeginPos, sliceBeginSpeed, sliceEndPos, sliceEndSpeed)
    }

    /** Create the envelope */
    fun build(): Envelope {
        if (overlayParts.isEmpty()) return base
        // build the final envelope
        val builder = EnvelopeBuilder()

        var previousOverlay: EnvelopePart? = null
        for (overlayPart in overlayParts) {
            builder.addParts(sliceBase(previousOverlay, overlayPart))
            builder.addPart(overlayPart)
            previousOverlay = overlayPart
        }

        builder.addParts(sliceBase(previousOverlay, null))
        return builder.build()
    }

    companion object {
        fun withDirection(base: Envelope, reverse: Boolean): OverlayEnvelopeBuilder {
            return OverlayEnvelopeBuilder(base, reverse)
        }

        @JvmStatic
        fun forward(base: Envelope): OverlayEnvelopeBuilder {
            return OverlayEnvelopeBuilder(base, false)
        }

        fun backward(base: Envelope): OverlayEnvelopeBuilder {
            return OverlayEnvelopeBuilder(base, true)
        }
    }
}
