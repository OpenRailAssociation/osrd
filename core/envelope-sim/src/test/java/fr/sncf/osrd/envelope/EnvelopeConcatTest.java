package fr.sncf.osrd.envelope;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.function.Function;
import org.junit.jupiter.api.Test;

public class EnvelopeConcatTest {

    @Test
    public void testSingleEnvelope() {
        var envelope = Envelope.make(
                EnvelopeTestUtils.generateTimes(new double[] {0, 1}, new double[] {1, 1}),
                EnvelopeTestUtils.generateTimes(new double[] {1, 2}, new double[] {1, 1}));
        var concatenated = EnvelopeConcat.from(List.of(envelope));

        // List of functions to call, they should return the same result for the envelope and the
        // concatenated version
        var functions = List.<Function<EnvelopeTimeInterpolate, Double>>of(
                in -> in.interpolateDepartureFrom(0),
                in -> in.interpolateDepartureFrom(1),
                in -> in.interpolateDepartureFrom(2),
                in -> in.interpolateDepartureFromUS(1.5) / 1_000.,
                in -> in.interpolateDepartureFromClamp(-1),
                in -> in.interpolateDepartureFromClamp(0.5),
                EnvelopeTimeInterpolate::getBeginPos,
                EnvelopeTimeInterpolate::getEndPos,
                EnvelopeTimeInterpolate::getTotalTime);

        for (var f : functions) assertEquals(f.apply(envelope), f.apply(concatenated));
        assertEquals(envelope.iteratePoints(), concatenated.iteratePoints());
    }

    @Test
    public void testTwoEnvelopes() {
        final var envelopes = List.of(
                Envelope.make(
                        EnvelopeTestUtils.generateTimes(new double[] {0, 1}, new double[] {1, 2}),
                        EnvelopeTestUtils.generateTimes(new double[] {1, 2}, new double[] {2, 3})),
                Envelope.make(
                        EnvelopeTestUtils.generateTimes(new double[] {0, 1}, new double[] {3, 4}),
                        EnvelopeTestUtils.generateTimes(new double[] {1, 2}, new double[] {4, 5})));
        final var concatenated = EnvelopeConcat.from(envelopes);
        final var firstEnvelopeTime = envelopes.get(0).getTotalTime();
        final var secondEnvelopeTime = envelopes.get(1).getTotalTime();

        assertEquals(
                firstEnvelopeTime + envelopes.get(1).interpolateDepartureFrom(1),
                concatenated.interpolateDepartureFrom(3));
        assertEquals(0, concatenated.getBeginPos());
        assertEquals(4, concatenated.getEndPos());
        assertEquals(firstEnvelopeTime + secondEnvelopeTime, concatenated.getTotalTime());

        final var points = concatenated.iteratePoints();
        final var firstPoint = points.get(0);
        final var lastPoint = points.get(points.size() - 1);
        assertEquals(0, firstPoint.time());
        assertEquals(0, firstPoint.position());
        assertEquals(1, firstPoint.speed());
        assertEquals(firstEnvelopeTime, secondEnvelopeTime, lastPoint.time());
        assertEquals(4, lastPoint.position());
        assertEquals(5, lastPoint.speed());
    }
}
