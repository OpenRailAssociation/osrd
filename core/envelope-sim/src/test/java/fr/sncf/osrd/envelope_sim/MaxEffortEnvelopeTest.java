package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope.EnvelopeShape.*;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeBuilder.makeComplexMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeBuilder.makeSimpleMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.SimpleContextBuilder.TIME_STEP;
import static fr.sncf.osrd.envelope_sim.SimpleContextBuilder.makeSimpleContext;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.envelope.EnvelopeTransitions;
import fr.sncf.osrd.envelope.MRSPEnvelopeBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import org.junit.jupiter.api.Test;
import java.util.List;

public class MaxEffortEnvelopeTest {
    @Test
    public void testFlat() {
        var length = 10000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] {6000, length};
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
        var testRollingStock = SimpleRollingStock.MAX_DEC_TRAIN;
        var testPath = new FlatPath(10000, 0);
        var testContext = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP,
                SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP);
        var stops = new double[] {6000, testPath.getLength()};
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
        var length = 10000;
        var testContext = makeSimpleContext(length, 20);
        var stops = new double[] {6000, length};
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
        var testRollingStock = SimpleRollingStock.MAX_DEC_TRAIN;
        var testPath = new FlatPath(10000, 20);
        var testContext = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP,
                SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP);
        var stops = new double[] {6000, testPath.getLength()};
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
        var length = 100000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] {50000, length};
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        check(maxEffortEnvelope, INCREASING, CONSTANT, INCREASING, CONSTANT, DECREASING, CONSTANT,
                DECREASING, INCREASING, CONSTANT, INCREASING, CONSTANT, INCREASING, DECREASING, CONSTANT, DECREASING);
        assertTrue(maxEffortEnvelope.continuous);
    }

    @Test
    public void testAccelerationInShortPart() {
        var length = 10000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] {length - 1, length};
        makeSimpleMaxEffortEnvelope(testContext, 10000, stops);
    }

    @Test
    public void testOverlappingBrakingCurves() {
        var testContext = makeSimpleContext(100, 0);
        var stops = new double[] {};
        var mrspBuilder = new MRSPEnvelopeBuilder();
        mrspBuilder.addPart(EnvelopePart.generateTimes(
                List.of(EnvelopeProfile.CONSTANT_SPEED),
                new double[] {0, 50},
                new double[] {30, 30}
        ));
        mrspBuilder.addPart(EnvelopePart.generateTimes(
                List.of(EnvelopeProfile.CONSTANT_SPEED),
                new double[] {50, 51},
                new double[] {29, 29}
        ));
        mrspBuilder.addPart(EnvelopePart.generateTimes(
                List.of(EnvelopeProfile.CONSTANT_SPEED),
                new double[] {51, 100},
                new double[] {1, 1}
        ));
        var mrsp = mrspBuilder.build();
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(testContext, stops, mrsp);
        MaxEffortEnvelope.from(testContext, 0, maxSpeedEnvelope);
    }
}
