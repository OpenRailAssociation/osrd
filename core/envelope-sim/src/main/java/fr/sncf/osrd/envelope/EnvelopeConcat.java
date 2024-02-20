package fr.sncf.osrd.envelope;

import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.arePositionsEqual;

import java.util.ArrayList;
import java.util.List;

/**
 * This class is used to concatenate envelopes without a deep copy of all the underlying data. All
 * envelopes are expected to start at position 0.
 */
public class EnvelopeConcat implements EnvelopeTimeInterpolate {

    private final List<LocatedEnvelope> envelopes;
    private final double endPos;

    private EnvelopeConcat(List<LocatedEnvelope> envelopes, double endPos) {
        this.envelopes = envelopes;
        this.endPos = endPos;
    }

    /** Creates an instance from a list of envelopes */
    public static EnvelopeConcat from(List<? extends EnvelopeTimeInterpolate> envelopes) {
        runSanityChecks(envelopes);
        var locatedEnvelopes = initLocatedEnvelopes(envelopes);
        var lastEnvelope = locatedEnvelopes.get(locatedEnvelopes.size() - 1);
        var endPos = lastEnvelope.startOffset + lastEnvelope.envelope.getEndPos();
        return new EnvelopeConcat(locatedEnvelopes, endPos);
    }

    /** Run some checks to ensure that the inputs match the assumptions made by this class */
    private static void runSanityChecks(List<? extends EnvelopeTimeInterpolate> envelopes) {
        assert !envelopes.isEmpty() : "concatenating no envelope";
        for (var envelope : envelopes)
            assert arePositionsEqual(0, envelope.getBeginPos()) : "concatenated envelope doesn't start at 0";
    }

    /** Place all envelopes in a record containing the offset on which they start */
    private static List<LocatedEnvelope> initLocatedEnvelopes(List<? extends EnvelopeTimeInterpolate> envelopes) {
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
        return interpolateTotalTime(endPos);
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
     * Returns the envelope at the given position. On transitions, the rightmost envelope is
     * returned.
     */
    private LocatedEnvelope findEnvelopeAt(double position) {
        if (position < 0) return null;
        for (var envelope : envelopes) {
            if (position < envelope.startOffset + envelope.envelope.getEndPos()) return envelope;
        }
        var lastEnvelope = envelopes.get(envelopes.size() - 1);
        if (arePositionsEqual(position, lastEnvelope.startOffset + lastEnvelope.envelope.getEndPos()))
            return lastEnvelope;
        return null;
    }

    private record LocatedEnvelope(EnvelopeTimeInterpolate envelope, double startOffset, double startTime) {}
}
