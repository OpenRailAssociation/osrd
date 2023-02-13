package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope.EnvelopeShape.*;
import static fr.sncf.osrd.envelope_sim.MaxSpeedEnvelopeTest.*;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.MRSPEnvelopeBuilder;
import fr.sncf.osrd.envelope.*;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.envelope_sim_infra.MRSP;
import fr.sncf.osrd.train.RollingStock.Comfort;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Test;
import java.util.List;

public class MaxEffortEnvelopeTest {
    /** Builds max effort envelope with the specified stops, on a flat MRSP */
    public static Envelope makeSimpleMaxEffortEnvelope(
            EnvelopeSimContext context,
            double speed,
            double[] stops
    ) {
        var flatMRSP = makeSimpleMRSP(context, speed);
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, flatMRSP);
        return MaxEffortEnvelope.from(context, 0, maxSpeedEnvelope);
    }

    /** Builds max effort envelope with one stop in the middle, one at the end, on a flat MRSP */
    static Envelope makeSimpleMaxEffortEnvelope(EnvelopeSimContext context, double speed) {
        var stops = new double[] { 6000, context.path.getLength() };
        return makeSimpleMaxEffortEnvelope(context, speed, stops);
    }

    /** Builds max effort envelope with one stop in the middle, one at the end, on a funky MRSP */
    static Envelope makeComplexMaxEffortEnvelope(
            EnvelopeSimContext context,
            double[] stops
    ) {
        var mrsp = makeComplexMRSP(context);
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, mrsp);
        return MaxEffortEnvelope.from(context, 0, maxSpeedEnvelope);
    }

    @Test
    public void testFlat() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(10000, 0);
        var testContext = EnvelopeSimContext.build(testRollingStock, testPath, TIME_STEP, Comfort.STANDARD);
        var stops = new double[] { 6000, testPath.getLength() };
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 44.4, stops);
        check(maxEffortEnvelope, INCREASING, CONSTANT, DECREASING, INCREASING, DECREASING);
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
        var testContext = EnvelopeSimContext.build(testRollingStock, testPath, TIME_STEP, Comfort.STANDARD);
        var stops = new double[] { 6000, testPath.getLength() };
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 44.4, stops);
        check(maxEffortEnvelope, INCREASING, CONSTANT, DECREASING, INCREASING, CONSTANT, DECREASING);
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
        var testContext = EnvelopeSimContext.build(testRollingStock, testPath, TIME_STEP, Comfort.STANDARD);
        var stops = new double[] { 6000, testPath.getLength() };
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 44.4, stops);
        check(maxEffortEnvelope, INCREASING, DECREASING, INCREASING, DECREASING);
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
        var testContext = EnvelopeSimContext.build(testRollingStock, testPath, TIME_STEP, Comfort.STANDARD);
        var stops = new double[] { 6000, testPath.getLength() };
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 44.4, stops);
        check(maxEffortEnvelope, INCREASING, DECREASING, INCREASING, DECREASING);
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
        var testContext = EnvelopeSimContext.build(testRollingStock, testPath, TIME_STEP, Comfort.STANDARD);
        var stops = new double[] { 50000, testPath.getLength() };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        check(maxEffortEnvelope, INCREASING, CONSTANT, INCREASING, CONSTANT, DECREASING, CONSTANT,
                DECREASING, INCREASING, CONSTANT, INCREASING, CONSTANT, INCREASING, DECREASING, CONSTANT, DECREASING);
        assertTrue(maxEffortEnvelope.continuous);
    }

    @Test
    public void testAccelerationInShortPart() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(10000, 0);
        var testContext = EnvelopeSimContext.build(testRollingStock, testPath, TIME_STEP, Comfort.STANDARD);
        var stops = new double[] { testPath.getLength() - 1, testPath.getLength() };
        makeSimpleMaxEffortEnvelope(testContext, 10000, stops);
    }

    @Test
    public void testOverlappingBrakingCurves() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(100, 0);
        var testContext = EnvelopeSimContext.build(testRollingStock, testPath, TIME_STEP, Comfort.STANDARD);
        var stops = new double[] {};
        var mrspBuilder = new MRSPEnvelopeBuilder();
        mrspBuilder.addPart(EnvelopePart.generateTimes(
                List.of(EnvelopeProfile.CONSTANT_SPEED, MRSP.LimitKind.TRAIN_LIMIT),
                new double[] {0, 50},
                new double[] {30, 30}
        ));
        mrspBuilder.addPart(EnvelopePart.generateTimes(
                List.of(EnvelopeProfile.CONSTANT_SPEED, MRSP.LimitKind.TRAIN_LIMIT),
                new double[] {50, 51},
                new double[] {29, 29}
        ));
        mrspBuilder.addPart(EnvelopePart.generateTimes(
                List.of(EnvelopeProfile.CONSTANT_SPEED, MRSP.LimitKind.TRAIN_LIMIT),
                new double[] {51, 100},
                new double[] {1, 1}
        ));
        var mrsp = mrspBuilder.build();
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(testContext, stops, mrsp);
        MaxEffortEnvelope.from(testContext, 0, maxSpeedEnvelope);
    }
}
