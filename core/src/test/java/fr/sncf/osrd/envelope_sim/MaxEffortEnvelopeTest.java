package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope.EnvelopeShape.*;
import static fr.sncf.osrd.envelope_sim.MaxSpeedEnvelopeTest.*;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.envelope.*;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Test;

public class MaxEffortEnvelopeTest {
    /** Builds max effort envelope with one stop in the middle, one at the end, on a flat MRSP */
    static Envelope makeSimpleMaxEffortEnvelope(
            PhysicsRollingStock rollingStock,
            PhysicsPath path,
            double speed,
            double[] stops
    ) {
        var flatMRSP = makeSimpleMRSP(rollingStock, path, speed);
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(rollingStock, path, stops, flatMRSP, TIME_STEP);
        return MaxEffortEnvelope.from(rollingStock, path, 0, maxSpeedEnvelope, TIME_STEP);
    }

    /** Builds max effort envelope with one stop in the middle, one at the end, on a funky MRSP */
    static Envelope makeComplexMaxEffortEnvelope(
            PhysicsRollingStock rollingStock,
            PhysicsPath path,
            double[] stops
    ) {
        var mrsp = makeComplexMRSP(rollingStock, path);
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(rollingStock, path, stops, mrsp, TIME_STEP);
        return MaxEffortEnvelope.from(rollingStock, path, 0, maxSpeedEnvelope, TIME_STEP);
    }

    @Test
    public void testFlat() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(10000, 0);
        var stops = new double[] { 6000, testPath.getLength() };
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testRollingStock, testPath, 44.4, stops);
        EnvelopeShape.check(maxEffortEnvelope, INCREASING, CONSTANT, DECREASING, INCREASING, DECREASING);
        var delta = 2 * maxEffortEnvelope.getMaxSpeed() * TIME_STEP;
        // don't modify these values, they have been calculated with a 0.01s timestep so they can be considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(maxEffortEnvelope, delta, 2726, 4029, 6000, 8292);
        assertTrue(maxEffortEnvelope.continuous);
    }

    @Test
    public void testFlatNonConstDec() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN_MAX_DEC_TYPE;
        var testPath = new FlatPath(10000, 0);
        var stops = new double[] { 6000, testPath.getLength() };
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testRollingStock, testPath, 44.4, stops);
        EnvelopeShape.check(maxEffortEnvelope, INCREASING, CONSTANT, DECREASING, INCREASING, CONSTANT, DECREASING);
        var delta = 2 * maxEffortEnvelope.getMaxSpeed() * TIME_STEP;
        // don't modify these values, they have been calculated with a 0.01s timestep so they can be considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(maxEffortEnvelope, delta, 2726, 4993, 6000, 8727, 8993);
        assertTrue(maxEffortEnvelope.continuous);
    }

    @Test
    public void testSteep() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(10000, 20);
        var stops = new double[] { 6000, testPath.getLength() };
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testRollingStock, testPath, 44.4, stops);
        EnvelopeShape.check(maxEffortEnvelope, INCREASING, DECREASING, INCREASING, DECREASING);
        var delta = 2 * maxEffortEnvelope.getMaxSpeed() * TIME_STEP;
        // don't modify these values, they have been calculated with a 0.01s timestep so they can be considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(maxEffortEnvelope, delta, 4380, 6000, 8827);
        assertTrue(maxEffortEnvelope.continuous);
    }

    @Test
    public void testSteepNonConstDec() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN_MAX_DEC_TYPE;
        var testPath = new FlatPath(10000, 20);
        var stops = new double[] { 6000, testPath.getLength() };
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testRollingStock, testPath, 44.4, stops);
        EnvelopeShape.check(maxEffortEnvelope, INCREASING, DECREASING, INCREASING, DECREASING);
        var delta = 2 * maxEffortEnvelope.getMaxSpeed() * TIME_STEP;
        // don't modify these values, they have been calculated with a 0.01s timestep so they can be considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(maxEffortEnvelope, delta, 5216, 6000, 9417);
        assertTrue(maxEffortEnvelope.continuous);
    }

    @Test
    public void testWithComplexMRSP() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(100000, 0);
        var stops = new double[] { 50000, testPath.getLength() };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testRollingStock, testPath, stops);
        EnvelopeShape.check(maxEffortEnvelope, INCREASING, CONSTANT, INCREASING, CONSTANT, DECREASING, CONSTANT,
                DECREASING, INCREASING, CONSTANT, INCREASING, CONSTANT, INCREASING, DECREASING, CONSTANT, DECREASING);
        assertTrue(maxEffortEnvelope.continuous);
    }
}
