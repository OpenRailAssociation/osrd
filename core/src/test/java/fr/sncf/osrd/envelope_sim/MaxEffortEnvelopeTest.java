package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope_sim.EnvelopeShape.*;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopePart;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Test;

public class MaxEffortEnvelopeTest {
    private Envelope makeTestEnvelope(double slope) {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(10000, slope);
        var stops = new double[] { 6000, 10000 };

        var flatMRSP = Envelope.make(
                EnvelopePart.generateTimes(null, new double[] { 0, 10000 }, new double[] { 44.4, 44.4})
        );
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(testRollingStock, testPath, stops, flatMRSP);
        return MaxEffortEnvelope.from(testRollingStock, testPath, 0, maxSpeedEnvelope);
    }

    @Test
    public void testFlat() {
        var maxEffortEnvelope = makeTestEnvelope(0);
        EnvelopeShape.check(maxEffortEnvelope, INCREASING, CONSTANT, DECREASING, INCREASING, DECREASING);
        EnvelopeTransitions.checkPositions(maxEffortEnvelope, 1.0, 2730, 4198, 6000, 8392);
        assertTrue(maxEffortEnvelope.continuous);
    }

    @Test
    public void testSteep() {
        var maxEffortEnvelope = makeTestEnvelope(20);
        EnvelopeShape.check(maxEffortEnvelope, INCREASING, DECREASING, INCREASING, DECREASING);
        EnvelopeTransitions.checkPositions(maxEffortEnvelope, 1.0, 4499, 6000, 8924);
        assertTrue(maxEffortEnvelope.continuous);
    }
}
