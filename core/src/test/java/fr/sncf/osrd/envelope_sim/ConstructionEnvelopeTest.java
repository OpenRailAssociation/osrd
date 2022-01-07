package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope.EnvelopeShape.*;
import static fr.sncf.osrd.envelope.EnvelopeShape.DECREASING;
import static fr.sncf.osrd.envelope_sim.MaxSpeedEnvelopeTest.TIME_STEP;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopePart;
import fr.sncf.osrd.envelope.EnvelopeShape;
import fr.sncf.osrd.envelope.EnvelopeTransitions;
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Test;

public class ConstructionEnvelopeTest {
    private Envelope makeConstructionEnvelope(double slope) {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var length = 10000;
        var testPath = new FlatPath(length, slope);
        var stops = new double[] { 6000, length };
        double capacitySpeedLimit = 30 / 3.6;

        var flatMRSP = Envelope.make(
                EnvelopePart.generateTimes(null, new double[] { 0, length }, new double[] { 44.4, 44.4})
        );
        var maxSpeedEnvelope = MaxSpeedEnvelope.from(testRollingStock, testPath, stops, flatMRSP, TIME_STEP);
        var maxEffortEnvelope =
                MaxEffortEnvelope.from(testRollingStock, testPath, 0, maxSpeedEnvelope, TIME_STEP);
        var allowance = new MarecoAllowance(testRollingStock, testPath, TIME_STEP,
                1000, 5000, capacitySpeedLimit, new AllowanceValue.FixedTime(60)
        );
        return allowance.apply(maxEffortEnvelope);
    }

    @Test
    public void testFlat() {
        var constructionEnvelope = makeConstructionEnvelope(0);
        EnvelopeShape.check(constructionEnvelope,
                INCREASING, DECREASING, CONSTANT, INCREASING, DECREASING, INCREASING, DECREASING);
        var delta = constructionEnvelope.getMaxSpeed() * TIME_STEP;
        EnvelopeTransitions.checkPositions(constructionEnvelope, delta,
                1000, 1051, 4520, 5000, 6000, 8400, 9294);
        assertTrue(constructionEnvelope.continuous);
    }

    @Test
    public void testSteep() {
        var constructionEnvelope = makeConstructionEnvelope(20);
        EnvelopeShape.check(constructionEnvelope,
                INCREASING, DECREASING, CONSTANT, INCREASING, DECREASING, INCREASING, DECREASING);
        var delta = constructionEnvelope.getMaxSpeed() * TIME_STEP;
        EnvelopeTransitions.checkPositions(constructionEnvelope, delta,
                1000, 1201, 2889, 5000, 6000, 8924);
        assertTrue(constructionEnvelope.continuous);
    }
}
