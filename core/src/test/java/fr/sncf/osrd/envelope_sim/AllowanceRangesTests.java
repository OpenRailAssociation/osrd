package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope.EnvelopeShape.*;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeTest.makeComplexMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeTest.makeSimpleMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.MaxSpeedEnvelopeTest.TIME_STEP;
import static fr.sncf.osrd.envelope_sim.allowances.AllowanceDistribution.DISTANCE_RATIO;
import static fr.sncf.osrd.envelope_sim.allowances.AllowanceDistribution.TIME_RATIO;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.envelope.*;
import fr.sncf.osrd.envelope_sim.allowances.AllowanceRange;
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue;
import fr.sncf.osrd.envelope_sim.allowances.HardenedMarecoAllowance;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Test;
import java.util.List;

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
        var ranges = List.of(
                new AllowanceRange(0, 0.3 * path.getLength(), value1),
                new AllowanceRange(0.3 * path.getLength(), path.getLength(), value2)
        );
        var allowance = new HardenedMarecoAllowance(
                context,
                0, path.getLength(), 0, ranges);
        return allowance.apply(maxEffortEnvelope);
    }

    public static double getDistance(HardenedMarecoAllowance allowance) {
        return allowance.endPos - allowance.beginPos;
    }

    @Test
    public void testRangesFlat() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(100000, 0);
        var testContext = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP);
        var marecoEnvelope = makeSimpleMarecoEnvelopeWithRanges(
                testContext,
                44.4,
                false,
                new AllowanceValue.Percentage(TIME_RATIO, 10),
                new AllowanceValue.Percentage(TIME_RATIO, 20));
        EnvelopeShape.check(marecoEnvelope,
                INCREASING, CONSTANT, DECREASING, CONSTANT, DECREASING, DECREASING);
        assertTrue(marecoEnvelope.continuous);
    }

    /** Test ranges with time ratio then distance ratio allowance */
    @Test
    public void testRangesOfDifferentTypes() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(100_000, 0);
        var testContext = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP);
        var stops = new double[] { 50000, testPath.getLength() };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var value1 = new AllowanceValue.Percentage(TIME_RATIO, 10);
        var value2 = new AllowanceValue.TimePerDistance(DISTANCE_RATIO, 4.5);
        var rangesTransition = 70_000;
        var ranges = List.of(
                new AllowanceRange(0, rangesTransition, value1),
                new AllowanceRange(rangesTransition, testPath.getLength(), value2)
        );
        var allowance = new HardenedMarecoAllowance(
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
