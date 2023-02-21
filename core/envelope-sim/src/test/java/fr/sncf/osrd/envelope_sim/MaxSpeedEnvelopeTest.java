package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope.EnvelopeShape.CONSTANT;
import static fr.sncf.osrd.envelope.EnvelopeShape.DECREASING;
import static fr.sncf.osrd.envelope_sim.SimpleContextBuilder.TIME_STEP;
import static fr.sncf.osrd.envelope_sim.SimpleContextBuilder.makeSimpleContext;
import static fr.sncf.osrd.envelope_sim.TestMRSPBuilder.makeComplexMRSP;
import static fr.sncf.osrd.envelope_sim.TestMRSPBuilder.makeSimpleMRSP;

import fr.sncf.osrd.envelope.EnvelopeShape;
import fr.sncf.osrd.envelope.EnvelopeTransitions;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import org.junit.jupiter.api.Test;


public class MaxSpeedEnvelopeTest {
    @Test
    public void testFlat() {
        var testContext = makeSimpleContext(100000, 0);
        var stops = new double[] { 8500 };

        var flatMRSP = makeSimpleMRSP(testContext, 44.4);
        var context = makeSimpleContext(100000, 0);
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, flatMRSP);
        EnvelopeShape.check(maxSpeedEnvelope, CONSTANT, DECREASING, CONSTANT);
        var delta = 2 * maxSpeedEnvelope.getMaxSpeed() * TIME_STEP;
        // don't modify these values, they have been calculated with a 0.1s timestep so they can be considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(maxSpeedEnvelope, delta, 6529, 8500);
        EnvelopeTransitions.checkContinuity(maxSpeedEnvelope, true, false);
    }

    @Test
    public void testSteep() {
        var testContext = makeSimpleContext(10000, 20);
        var stops = new double[] { 8500 };

        var flatMRSP = makeSimpleMRSP(testContext, 44.4);
        var context = makeSimpleContext(10000, 20);
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, flatMRSP);
        EnvelopeShape.check(maxSpeedEnvelope, CONSTANT, DECREASING, CONSTANT);
        var delta = 2 * maxSpeedEnvelope.getMaxSpeed() * TIME_STEP;
        // don't modify these values, they have been calculated with a 0.1s timestep so they can be considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(maxSpeedEnvelope, delta, 6529, 8500);
        EnvelopeTransitions.checkContinuity(maxSpeedEnvelope, true, false);
    }

    @Test
    public void testInitialStop() {
        var testContext = makeSimpleContext(10000, 0);
        var stops = new double[]{0};

        var flatMRSP = makeSimpleMRSP(testContext, 44.4);
        var context = makeSimpleContext(10000, 0);
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, flatMRSP);
        EnvelopeShape.check(maxSpeedEnvelope, CONSTANT);
    }

    @Test
    public void testFlatNonConstDec() {
        var testRollingStock = SimpleRollingStock.MAX_DEC_TRAIN;
        var effortCurveMap = SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP;
        var testPath = new FlatPath(10000, 0);
        var testContext = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP, effortCurveMap);
        var stops = new double[] { 8500 };

        var flatMRSP = makeSimpleMRSP(testContext, 44.4);
        var context = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP, effortCurveMap);
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, flatMRSP);
        EnvelopeShape.check(maxSpeedEnvelope, CONSTANT, DECREASING, CONSTANT);
        var delta = 2 * maxSpeedEnvelope.getMaxSpeed() * TIME_STEP;
        // don't modify these values, they have been calculated with a 0.1s timestep so they can be considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(maxSpeedEnvelope, delta, 7493, 8500);
        EnvelopeTransitions.checkContinuity(maxSpeedEnvelope, true, false);
    }

    @Test
    public void testWithComplexMRSP() {
        var length = 100000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] {50000, length};

        var mrsp = makeComplexMRSP(testContext);
        var context = makeSimpleContext(length, 0);
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, mrsp);
        EnvelopeShape.check(maxSpeedEnvelope, CONSTANT, CONSTANT, DECREASING, CONSTANT,
                DECREASING, CONSTANT, CONSTANT, CONSTANT, DECREASING, CONSTANT, DECREASING);
        EnvelopeTransitions.checkContinuity(maxSpeedEnvelope,
                false, true, true, true, false, false, false, true, true, true);
    }
}
