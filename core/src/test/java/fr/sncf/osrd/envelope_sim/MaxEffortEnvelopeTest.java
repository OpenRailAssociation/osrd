package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope.EnvelopeShape.*;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static fr.sncf.osrd.envelope_sim.MaxSpeedEnvelopeTest.TIME_STEP;

import fr.sncf.osrd.envelope.*;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Test;

public class MaxEffortEnvelopeTest {
    private Envelope makeMaxEffortEnvelope(RollingStock rollingStock, double slope) {
        var length = 10000;
        var testPath = new FlatPath(length, slope);
        var stops = new double[] { 6000, length };

        var flatMRSP = Envelope.make(
                EnvelopePart.generateTimes(null, new double[] { 0, length }, new double[] { 44.4, 44.4})
        );
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(rollingStock, testPath, stops, flatMRSP, TIME_STEP);
        return MaxEffortEnvelope.from(rollingStock, testPath, 0, maxSpeedEnvelope, TIME_STEP);
    }

    @Test
    public void testFlat() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var maxEffortEnvelope = makeMaxEffortEnvelope(testRollingStock, 0);
        EnvelopeShape.check(maxEffortEnvelope, INCREASING, CONSTANT, DECREASING, INCREASING, DECREASING);
        EnvelopeTransitions.checkPositions(maxEffortEnvelope, 1.0, 2730, 4198, 6000, 8392);
        assertTrue(maxEffortEnvelope.continuous);
    }

    @Test
    public void testFlatNonConstDec() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN_MAX_DEC_TYPE;
        var maxEffortEnvelope = makeMaxEffortEnvelope(testRollingStock, 0);
        EnvelopeShape.check(maxEffortEnvelope, INCREASING, CONSTANT, DECREASING, INCREASING, CONSTANT, DECREASING);
        EnvelopeTransitions.checkPositions(maxEffortEnvelope, 1.0, 2730, 5157, 6000, 8731, 9157);
        assertTrue(maxEffortEnvelope.continuous);
    }

    @Test
    public void testSteep() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var maxEffortEnvelope = makeMaxEffortEnvelope(testRollingStock, 20);
        EnvelopeShape.check(maxEffortEnvelope, INCREASING, DECREASING, INCREASING, DECREASING);
        EnvelopeTransitions.checkPositions(maxEffortEnvelope, 1.0, 4499, 6000, 8924);
        assertTrue(maxEffortEnvelope.continuous);
    }

    @Test
    public void testSteepNonConstDec() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN_MAX_DEC_TYPE;
        var maxEffortEnvelope = makeMaxEffortEnvelope(testRollingStock, 20);
        EnvelopeShape.check(maxEffortEnvelope, INCREASING, DECREASING, INCREASING, DECREASING);
        EnvelopeTransitions.checkPositions(maxEffortEnvelope, 1.0, 5355, 6000, 9532);
        assertTrue(maxEffortEnvelope.continuous);
    }
}
