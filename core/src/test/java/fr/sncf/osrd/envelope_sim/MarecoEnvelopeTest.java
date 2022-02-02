package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope.EnvelopeShape.*;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeTest.makeComplexMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeTest.makeSimpleMaxEffortEnvelope;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static fr.sncf.osrd.envelope_sim.MaxSpeedEnvelopeTest.TIME_STEP;

import fr.sncf.osrd.envelope.*;
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;


public class MarecoEnvelopeTest {
    private Envelope makeSimpleMarecoEnvelope(PhysicsRollingStock rollingStock, PhysicsPath path, double speed,
                                              AllowanceValue value) {
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(rollingStock, path, speed);
        var allowance = new MarecoAllowance(
                rollingStock, path, TIME_STEP, 0, path.getLength(), 0, value);
        return allowance.apply(maxEffortEnvelope);
    }

    @Test
    public void testFlat() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(10000, 0);
        var marecoEnvelope = makeSimpleMarecoEnvelope(
                testRollingStock, testPath, 44.4, new AllowanceValue.Percentage(10));
        EnvelopeShape.check(marecoEnvelope, INCREASING, DECREASING, DECREASING, INCREASING, DECREASING, DECREASING);
        var delta = 2 * marecoEnvelope.getMaxSpeed() * TIME_STEP;
        // don't modify these values, they have been calculated with a 0.01s timestep so they can be considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(marecoEnvelope, delta, 901, 5452, 6000, 6783, 9452);
        assertTrue(marecoEnvelope.continuous);
    }

    @Test
    public void testSteep() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(10000, 20);
        var marecoEnvelope = makeSimpleMarecoEnvelope(
                testRollingStock, testPath, 44.4, new AllowanceValue.Percentage(10));
        EnvelopeShape.check(marecoEnvelope,
                INCREASING, CONSTANT, DECREASING, DECREASING, INCREASING, CONSTANT, DECREASING, DECREASING);
        var delta = 2 * marecoEnvelope.getMaxSpeed() * TIME_STEP;
        // don't modify these values, they have been calculated with a 0.01s timestep so they can be considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(marecoEnvelope, delta,
                1238, 4780, 5833, 6000, 7238, 8780, 9833);
        assertTrue(marecoEnvelope.continuous);
    }

    /** Test mareco with percentage time allowance */
    @ParameterizedTest
    @ValueSource(doubles = {0.0, 10, 100})
    public void testMarecoAllowance(double value) {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(100000, 0);

        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testRollingStock, testPath);
        var allowanceValue = new AllowanceValue.Percentage(value);
        var allowance = new MarecoAllowance(testRollingStock, testPath, TIME_STEP,
                0, testPath.getLength(), 0, allowanceValue);
        var marecoEnvelope = allowance.apply(maxEffortEnvelope);
        var baseTime = maxEffortEnvelope.getTotalTime();
        var distance = allowance.sectionEnd - allowance.sectionBegin;
        var targetTime = baseTime + allowanceValue.getAllowanceTime(baseTime, distance);
        var marginTime = marecoEnvelope.getTotalTime();
        assertEquals(marginTime, targetTime, 2 * TIME_STEP);
    }

    /** Test mareco with a time per distance allowance */
    @ParameterizedTest
    @ValueSource(doubles = {0.0, 4.5, 5.5})
    public void testMarecoAllowanceDistance(double value) {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(100000, 0);

        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testRollingStock, testPath);
        var allowanceValue = new AllowanceValue.TimePerDistance(value);
        var allowance = new MarecoAllowance(testRollingStock, testPath, TIME_STEP,
                0, testPath.getLength(), 0, allowanceValue);
        var marecoEnvelope = allowance.apply(maxEffortEnvelope);
        var baseTime = maxEffortEnvelope.getTotalTime();
        var distance = allowance.sectionEnd - allowance.sectionBegin;
        var targetTime = baseTime + allowanceValue.getAllowanceTime(baseTime, distance);
        var marginTime = marecoEnvelope.getTotalTime();
        assertEquals(marginTime, targetTime, 2 * TIME_STEP);
    }
}
