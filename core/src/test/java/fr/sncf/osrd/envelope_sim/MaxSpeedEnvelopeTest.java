package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope.EnvelopeShape.*;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopePart;
import fr.sncf.osrd.envelope.EnvelopeShape;
import fr.sncf.osrd.envelope.EnvelopeTransitions;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Test;


public class MaxSpeedEnvelopeTest {

    static final double TIME_STEP = 4.0;

    @Test
    public void testFlat() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var length = 10000;
        var testPath = new FlatPath(length, 0);
        var stops = new double[] { 8500 };

        var flatMRSP = Envelope.make(
                        EnvelopePart.generateTimes(null, new double[] { 0, length}, new double[] { 44.4, 44.4})
                );
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(testRollingStock, testPath, stops, flatMRSP, TIME_STEP);
        EnvelopeShape.check(maxSpeedEnvelope, CONSTANT, DECREASING, CONSTANT);
        EnvelopeTransitions.checkPositions(maxSpeedEnvelope, 1.0, 6698, 8500);
        EnvelopeTransitions.checkContinuity(maxSpeedEnvelope, true, false);
    }
}
