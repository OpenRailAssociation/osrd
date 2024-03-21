package fr.sncf.osrd.envelope;

import java.util.ArrayList;
import java.util.List;

/**
 * This class is used to concatenate envelopes without a deep copy of all the underlying data. All
 * envelopes are expected to start at position 0.
 */
public class EnvelopeConcat implements EnvelopeInterpolate {

    private final List<LocatedEnvelope> envelopes;
    private final double endPos;

    private EnvelopeConcat(List<LocatedEnvelope> envelopes, double endPos) {
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
    public static EnvelopeConcat fromLocated(List<LocatedEnvelope> envelopes) {
        var lastEnvelope = envelopes.get(envelopes.size() - 1);
        var endPos = lastEnvelope.startOffset + lastEnvelope.envelope.getEndPos();
        return new EnvelopeConcat(envelopes, endPos);
    }

    /** Place all envelopes in a record containing the offset on which they start */
    private static List<LocatedEnvelope> initLocatedEnvelopes(List<? extends EnvelopeInterpolate> envelopes) {
        double currentOffset = 0.0;
        double currentTime = 0.0;
        var res = new ArrayList<LocatedEnvelope>();
        for (var envelope : envelopes) {
            res.add(new LocatedEnvelope(envelope, currentOffset, currentTime));
            currentOffset += envelope.getEndPos();
            currentTime += envelope.getTotalTime();
        }
        return res;
    }

    @Override
    public double interpolateTotalTime(double position) {
        var envelope = findEnvelopeAt(position);
        assert envelope != null : "Trying to interpolate time outside of the envelope";
        return envelope.startTime + envelope.envelope.interpolateTotalTimeClamp(position - envelope.startOffset);
    }

    @Override
    public long interpolateTotalTimeMS(double position) {
        return (long) (interpolateTotalTime(position) * 1000);
    }

    @Override
    public double interpolateTotalTimeClamp(double position) {
        var clamped = Math.max(0, Math.min(position, endPos));
        return interpolateTotalTime(clamped);
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
    public List<EnvelopePoint> iteratePoints() {
        return envelopes.stream()
                .flatMap(locatedEnvelope -> locatedEnvelope.envelope.iteratePoints().stream()
                        .map(p -> new EnvelopePoint(
                                p.time() + locatedEnvelope.startTime,
                                p.speed(),
                                p.position() + locatedEnvelope.startOffset)))
                .toList();
    }

    /**
     * Returns the envelope at the given position.
     */
    private LocatedEnvelope findEnvelopeAt(double position) {
        var index = findEnvelopeIndexAt(position);
        return index == -1 ? null : envelopes.get(index);
    }

    /**
     * Returns the index of the envelope at the given position.
     */
    private int findEnvelopeIndexAt(double position) {
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
            } else {
                return i;
            }
        }
        return -1;
    }

    @Override
    public double maxSpeedInRange(double beginPos, double endPos) {
        var firstEnvelopeIndex = findEnvelopeIndexAt(beginPos);
        assert firstEnvelopeIndex != -1 : "Trying to interpolate time outside of the envelope";
        var firstEnvelope = envelopes.get(firstEnvelopeIndex);
        var beginSpeed = firstEnvelope.envelope.maxSpeedInRange(beginPos - firstEnvelope.startOffset, firstEnvelope.envelope.getEndPos());

        var lastEnvelopeIndex = findEnvelopeIndexAt(endPos);
        assert lastEnvelopeIndex != -1 : "Trying to interpolate time outside of the envelope";
        var lastEnvelope = envelopes.get(lastEnvelopeIndex);
        var endSpeed = lastEnvelope.envelope.maxSpeedInRange(0, endPos - lastEnvelope.startOffset);

        var maxSpeed = beginSpeed;
        for (var i = firstEnvelopeIndex + 1; i < lastEnvelopeIndex; i++) {
            var envelope = envelopes.get(i);
            var speed = envelope.envelope.maxSpeedInRange(0, envelope.envelope.getEndPos());
            if (speed > maxSpeed) maxSpeed = speed;
        }

        if (endSpeed > maxSpeed) maxSpeed = endSpeed;
        return maxSpeed;
    }

    public record LocatedEnvelope(EnvelopeInterpolate envelope, double startOffset, double startTime) {}
}
