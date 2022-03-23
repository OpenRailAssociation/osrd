package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope.EnvelopeShape.*;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeTest.makeComplexMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeTest.makeSimpleMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.MaxSpeedEnvelopeTest.TIME_STEP;
import static fr.sncf.osrd.envelope_sim.allowances.AllowanceDistribution.DISTANCE_RATIO;
import static fr.sncf.osrd.envelope_sim.allowances.AllowanceDistribution.TIME_RATIO;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeShape;
import fr.sncf.osrd.envelope_sim.allowances.AllowanceRange;
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Test;

public class AllowanceRangesTests {

    private Envelope makeSimpleMarecoEnvelopeWithRanges(EnvelopeSimContext context,
                                                        double speed,
                                                        boolean stop,
                                                        AllowanceValue value1,
                                                        AllowanceValue value2) {
        var path = context.path;
        double[] stops;
        if (stop)
            stops = new double[] {6000, path.getLength() };
        else
            stops = new double[] { path.getLength() };
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(context, speed, stops);
        AllowanceRange[] ranges = new AllowanceRange[2];
        ranges[0] = new AllowanceRange(0, 3000, value1);
        ranges[1] = new AllowanceRange(3000, path.getLength(), value2);
        var allowance = new MarecoAllowance(
                context,
                0, path.getLength(), 0, ranges);
        return allowance.apply(maxEffortEnvelope);
    }

    public static double getDistance(MarecoAllowance allowance) {
        return allowance.endPos - allowance.beginPos;
    }

    @Test
    public void testRangesFlat() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(10000, 0);
        var testContext = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP);
        var marecoEnvelope = makeSimpleMarecoEnvelopeWithRanges(
                testContext,
                44.4,
                true,
                new AllowanceValue.Percentage(TIME_RATIO, 10),
                new AllowanceValue.Percentage(TIME_RATIO, 20));
        EnvelopeShape.check(marecoEnvelope,
                INCREASING, CONSTANT, DECREASING, DECREASING, INCREASING, DECREASING, DECREASING);
        assertTrue(marecoEnvelope.continuous);
    }

    /** Test ranges with time ratio then ditance ratio allowance */
    @Test
    public void testRangesOfDifferentTypes() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(100_000, 0);
        var testContext = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP);
        var stops = new double[] { 50000, testPath.getLength() };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var value1 = new AllowanceValue.Percentage(TIME_RATIO, 10);
        var value2 = new AllowanceValue.TimePerDistance(DISTANCE_RATIO, 4.5);
        AllowanceRange[] ranges = new AllowanceRange[2];
        var rangesTransition = 70_000;
        ranges[0] = new AllowanceRange(0, rangesTransition, value1);
        ranges[1] = new AllowanceRange(rangesTransition, testPath.getLength(), value2);
        var allowance = new MarecoAllowance(
                testContext, 0, testPath.getLength(), 30 / 3.6, ranges
        );
        var marecoEnvelope = allowance.apply(maxEffortEnvelope);
        var baseTime1 = maxEffortEnvelope.getTimeBetween(0, rangesTransition);
        var baseTime2 = maxEffortEnvelope.getTimeBetween(rangesTransition, testPath.getLength());
        var totalBaseTime = maxEffortEnvelope.getTotalTime();
        assertEquals(totalBaseTime, baseTime1 + baseTime2, 2 * TIME_STEP);
        var distance = getDistance(allowance);
        var targetTime1 = baseTime1 + value1.getAllowanceTime(baseTime1, rangesTransition);
        var targetTime2 = baseTime2 + value2.getAllowanceTime(baseTime2, distance - rangesTransition);
        var marginTime1 = marecoEnvelope.getTimeBetween(0, rangesTransition);
        var marginTime2 = marecoEnvelope.getTimeBetween(rangesTransition, testPath.getLength());
        assertEquals(marginTime1, targetTime1, 2 * TIME_STEP);
        assertEquals(marginTime2, targetTime2, 2 * TIME_STEP);
    }
}
