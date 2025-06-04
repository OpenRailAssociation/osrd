package fr.sncf.osrd.envelope;

import static fr.sncf.osrd.envelope_utils.DoubleUtils.clamp;
import static java.lang.Math.max;
import static java.lang.Math.min;

import java.util.ArrayList;
import java.util.List;
import org.jetbrains.annotations.Nullable;

/**
 * This class is used to concatenate envelopes without a deep copy of all the underlying data. All
 * envelopes are expected to start at position 0.
 */
public class EnvelopeConcat implements EnvelopeInterpolate {

    private final List<LocatedEnvelopeInterpolate> envelopes;
    private final double endPos;

    private EnvelopeConcat(List<LocatedEnvelopeInterpolate> envelopes, double endPos) {
        this.envelopes = envelopes;
        this.endPos = endPos;
    }

    /** Creates an instance from a list of envelopes */
    public static EnvelopeConcat from(List<? extends EnvelopeInterpolate> envelopes) {
        var locatedEnvelopes = initLocatedEnvelopes(envelopes);
        var lastEnvelope = locatedEnvelopes.get(locatedEnvelopes.size() - 1);
        var endPos = lastEnvelope.startOffset + lastEnvelope.envelope.getEndPos();
        return new EnvelopeConcat(locatedEnvelopes, endPos);
    }

    /** Creates an instance from a list of located envelopes.
     * Avoids redundant initialization when elements are appended to one envelope list. */
    public static EnvelopeConcat fromLocated(List<LocatedEnvelopeInterpolate> envelopes) {
        var lastEnvelope = envelopes.get(envelopes.size() - 1);
        var endPos = lastEnvelope.startOffset + lastEnvelope.envelope.getEndPos();
        return new EnvelopeConcat(envelopes, endPos);
    }

    /** Place all envelopes in a record containing the offset on which they start */
    private static List<LocatedEnvelopeInterpolate> initLocatedEnvelopes(
            List<? extends EnvelopeInterpolate> envelopes) {
        double currentOffset = 0.0;
        double currentTime = 0.0;
        var res = new ArrayList<LocatedEnvelopeInterpolate>();
        for (var envelope : envelopes) {
            res.add(new LocatedEnvelopeInterpolate(envelope, currentOffset, currentTime));
            currentOffset += envelope.getEndPos();
            currentTime += envelope.getTotalTime();
        }
        return res;
    }

    @Override
    public double interpolateArrivalAt(double position) {
        var envelope = findEnvelopeLeftAt(position);
        assert envelope != null : "Trying to interpolate time outside of the envelope";
        return envelope.startTime + envelope.envelope.interpolateArrivalAtClamp(position - envelope.startOffset);
    }

    @Override
    public double interpolateDepartureFrom(double position) {
        var envelope = findEnvelopeRightAt(position);
        assert envelope != null : "Trying to interpolate time outside of the envelope";
        return envelope.startTime + envelope.envelope.interpolateDepartureFromClamp(position - envelope.startOffset);
    }

    @Override
    public long interpolateArrivalAtUS(double position) {
        return (long) (interpolateArrivalAt(position) * 1_000_000);
    }

    @Override
    public long interpolateDepartureFromUS(double position) {
        return (long) (interpolateDepartureFrom(position) * 1_000_000);
    }

    @Override
    public double interpolateArrivalAtClamp(double position) {
        return interpolateArrivalAt(clamp(position, 0, endPos));
    }

    @Override
    public double interpolateDepartureFromClamp(double position) {
        return interpolateDepartureFrom(clamp(position, 0, endPos));
    }

    @Override
    public double getBeginPos() {
        return 0;
    }

    @Override
    public double getEndPos() {
        return endPos;
    }

    @Override
    public double getTotalTime() {
        var lastEnvelope = envelopes.get(envelopes.size() - 1);
        return lastEnvelope.startTime + lastEnvelope.envelope.getTotalTime();
    }

    @Override
    public @Nullable Envelope getRawEnvelopeIfSingle() {
        // See interface: building concatenation is probably not a good idea
        return null;
    }

    @Override
    public List<EnvelopePoint> iteratePoints() {
        return envelopes.stream()
                .flatMap(envelope -> envelope.envelope.iteratePoints().stream()
                        .map(p -> new EnvelopePoint(
                                p.time() + envelope.startTime, p.speed(), p.position() + envelope.startOffset)))
                .toList();
    }

    /**
     * Returns the envelope at the given position.
     */
    private LocatedEnvelopeInterpolate findEnvelopeLeftAt(double position) {
        var index = findEnvelopeIndexAt(position, true);
        return index == -1 ? null : envelopes.get(index);
    }

    /**
     * Returns the envelope at the given position.
     */
    private LocatedEnvelopeInterpolate findEnvelopeRightAt(double position) {
        var index = findEnvelopeIndexAt(position, false);
        return index == -1 ? null : envelopes.get(index);
    }

    /**
     * Returns the index of the envelope at the given position.
     */
    private int findEnvelopeIndexAt(double position, boolean searchLeft) {
        if (position < 0) return -1;
        var lowerBound = 0; // included
        var upperBound = envelopes.size(); // excluded
        while (lowerBound < upperBound) {
            var i = (lowerBound + upperBound) / 2;
            var envelope = envelopes.get(i);
            if (position < envelope.startOffset) {
                upperBound = i;
            } else if (position > envelope.startOffset + envelope.envelope.getEndPos()) {
                lowerBound = i + 1;
            } else if (searchLeft && position == envelope.startOffset && i > 0) {
                return i - 1;
            } else if (!searchLeft
                    && position == envelope.startOffset + envelope.envelope.getEndPos()
                    && i < envelopes.size() - 1) {
                return i + 1;
            } else {
                return i;
            }
        }
        return -1;
    }

    @Override
    public double maxSpeedInRange(double beginPos, double endPos) {
        var firstEnvelopeIndex = findEnvelopeIndexAt(beginPos, false);
        assert firstEnvelopeIndex != -1 : "Trying to interpolate time outside of the envelope";
        var firstEnvelope = envelopes.get(firstEnvelopeIndex);
        var firstEnvelopeMaxSpeed = firstEnvelope.envelope.maxSpeedInRange(
                beginPos - firstEnvelope.startOffset,
                min(firstEnvelope.envelope.getEndPos(), endPos - firstEnvelope.startOffset));

        var lastEnvelopeIndex = findEnvelopeIndexAt(endPos, true);
        if (lastEnvelopeIndex == firstEnvelopeIndex) return firstEnvelopeMaxSpeed;
        assert lastEnvelopeIndex != -1 : "Trying to interpolate time outside of the envelope";
        var lastEnvelope = envelopes.get(lastEnvelopeIndex);
        var endOffset = endPos - lastEnvelope.startOffset;
        if (Math.abs(endOffset - lastEnvelope.envelope.getEndPos()) < 1e-6) {
            endOffset = lastEnvelope.envelope.getEndPos();
        }
        var lastEnvelopeMaxSpeed = lastEnvelope.envelope.maxSpeedInRange(0, endOffset);

        var maxSpeed = max(firstEnvelopeMaxSpeed, lastEnvelopeMaxSpeed);
        for (var i = firstEnvelopeIndex + 1; i < lastEnvelopeIndex; i++) {
            var envelope = envelopes.get(i);
            var speed = envelope.envelope.maxSpeedInRange(0, envelope.envelope.getEndPos());
            if (speed > maxSpeed) maxSpeed = speed;
        }

        return maxSpeed;
    }

    public record LocatedEnvelopeInterpolate(EnvelopeInterpolate envelope, double startOffset, double startTime) {}
}
