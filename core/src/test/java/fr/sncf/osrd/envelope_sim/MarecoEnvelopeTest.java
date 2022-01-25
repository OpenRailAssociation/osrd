package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope.EnvelopeShape.*;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static fr.sncf.osrd.envelope_sim.MaxSpeedEnvelopeTest.TIME_STEP;

import fr.sncf.osrd.envelope.*;
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Test;


public class MarecoEnvelopeTest {
    private Envelope makeMarecoEnvelope(double slope) {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var length = 10000;
        var testPath = new FlatPath(length, slope);
        var stops = new double[] { 6000, length };

        var flatMRSP = Envelope.make(
                EnvelopePart.generateTimes(null, new double[] { 0, length }, new double[] { 44.4, 44.4})
        );
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(testRollingStock, testPath, stops, flatMRSP, TIME_STEP);
        var maxEffortEnvelope =
                MaxEffortEnvelope.from(testRollingStock, testPath, 0, maxSpeedEnvelope, TIME_STEP);
        var allowance = new MarecoAllowance(
                testRollingStock,
                testPath,
                TIME_STEP,
                0,
                length,
                new AllowanceValue.Percentage(10)
        );
        return allowance.apply(maxEffortEnvelope);
    }

    @Test
    public void testFlat() {
        var marecoEnvelope = makeMarecoEnvelope(0);
        EnvelopeShape.check(marecoEnvelope, INCREASING, DECREASING, DECREASING, INCREASING, DECREASING, DECREASING);
        var delta = marecoEnvelope.getMaxSpeed() * TIME_STEP;
        EnvelopeTransitions.checkPositions(marecoEnvelope, delta, 1285, 5294, 6000, 7136, 9294);
        assertTrue(marecoEnvelope.continuous);
    }

    @Test
    public void testSteep() {
        var marecoEnvelope = makeMarecoEnvelope(20);
        EnvelopeShape.check(marecoEnvelope,
                INCREASING, CONSTANT, DECREASING, DECREASING, INCREASING, CONSTANT, DECREASING, DECREASING);
        var delta = marecoEnvelope.getMaxSpeed() * TIME_STEP;
        EnvelopeTransitions.checkPositions(marecoEnvelope, delta, 1395, 4756, 5856, 6000, 7395, 8756, 9856);
        assertTrue(marecoEnvelope.continuous);
    }
}
