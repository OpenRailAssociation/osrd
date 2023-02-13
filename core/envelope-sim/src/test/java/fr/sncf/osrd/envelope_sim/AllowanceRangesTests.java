package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope.EnvelopeShape.*;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeTest.makeComplexMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeTest.makeSimpleMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.MaxSpeedEnvelopeTest.TIME_STEP;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeShape;
import fr.sncf.osrd.envelope_sim.allowances.Allowance;
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceConvergenceException;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.train.RollingStock.Comfort;
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
        var testPath = new FlatPath(100000, 0);
        var testContext = EnvelopeSimContext.build(testRollingStock, testPath, TIME_STEP, Comfort.STANDARD);
        var marecoEnvelope = makeSimpleMarecoEnvelopeWithRanges(
                testContext,
                44.4,
                false,
                new AllowanceValue.Percentage(10),
                new AllowanceValue.Percentage(20));
        check(marecoEnvelope,
                INCREASING, CONSTANT, DECREASING, CONSTANT, DECREASING, DECREASING);
        assertTrue(marecoEnvelope.continuous);
    }

    /** Test ranges with time ratio then distance ratio allowance */
    @Test
    public void testRangesOfDifferentTypes() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(100_000, 0);
        var testContext = EnvelopeSimContext.build(testRollingStock, testPath, TIME_STEP, Comfort.STANDARD);
        var stops = new double[] { 50000, testPath.getLength() };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var value1 = new AllowanceValue.Percentage(10);
        var value2 = new AllowanceValue.TimePerDistance(4.5);
        var rangesTransition = 70_000;
        var ranges = List.of(
                new AllowanceRange(0, rangesTransition, value1),
                new AllowanceRange(rangesTransition, testPath.getLength(), value2)
        );
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

    /** Test ranges with decreasing values */
    @Test
    public void testRangesWithDecreasingValues() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var length = 100_000;
        var testPath = new FlatPath(length, 0);
        var testContext = EnvelopeSimContext.build(testRollingStock, testPath, TIME_STEP, Comfort.STANDARD);
        var stops = new double[] { 50000, testPath.getLength() };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var value1 = new AllowanceValue.Percentage(15);
        var value2 = new AllowanceValue.Percentage(10);
        var value3 = new AllowanceValue.Percentage(5);
        var rangesTransitions = new double[] { 0, 30_000, 70_000, length };
        var ranges = List.of(
                new AllowanceRange(rangesTransitions[0], rangesTransitions[1], value1),
                new AllowanceRange(rangesTransitions[1], rangesTransitions[2], value2),
                new AllowanceRange(rangesTransitions[2], rangesTransitions[3], value3)
        );
        var allowance = new MarecoAllowance(
                testContext, 0, testPath.getLength(), 30 / 3.6, ranges
        );
        var marecoEnvelope = allowance.apply(maxEffortEnvelope);
        var baseTime1 = maxEffortEnvelope.getTimeBetween(rangesTransitions[0], rangesTransitions[1]);
        var baseTime2 = maxEffortEnvelope.getTimeBetween(rangesTransitions[1], rangesTransitions[2]);
        var baseTime3 = maxEffortEnvelope.getTimeBetween(rangesTransitions[2], rangesTransitions[3]);
        var totalBaseTime = maxEffortEnvelope.getTotalTime();
        assertEquals(totalBaseTime, baseTime1 + baseTime2 + baseTime3, 3 * TIME_STEP);
        var targetTime1 = baseTime1 + value1.getAllowanceTime(baseTime1, rangesTransitions[1] - rangesTransitions[0]);
        var targetTime2 = baseTime2 + value2.getAllowanceTime(baseTime2, rangesTransitions[2] - rangesTransitions[1]);
        var targetTime3 = baseTime3 + value3.getAllowanceTime(baseTime3, rangesTransitions[3] - rangesTransitions[2]);
        var marginTime1 = marecoEnvelope.getTimeBetween(rangesTransitions[0], rangesTransitions[1]);
        var marginTime2 = marecoEnvelope.getTimeBetween(rangesTransitions[1], rangesTransitions[2]);
        var marginTime3 = marecoEnvelope.getTimeBetween(rangesTransitions[2], rangesTransitions[3]);
        assertEquals(marginTime1, targetTime1, 2 * TIME_STEP);
        assertEquals(marginTime2, targetTime2, 2 * TIME_STEP);
        assertEquals(marginTime3, targetTime3, 2 * TIME_STEP);
    }

    /** Test ranges with increasing values */
    @Test
    public void testRangesWithIncreasingValues() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var length = 100_000;
        var testPath = new FlatPath(length, 0);
        var testContext = EnvelopeSimContext.build(testRollingStock, testPath, TIME_STEP, Comfort.STANDARD);
        var stops = new double[] { 50000, testPath.getLength() };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var value1 = new AllowanceValue.Percentage(5);
        var value2 = new AllowanceValue.Percentage(10);
        var value3 = new AllowanceValue.Percentage(15);
        var rangesTransitions = new double[] { 0, 30_000, 70_000, length };
        var ranges = List.of(
                new AllowanceRange(rangesTransitions[0], rangesTransitions[1], value1),
                new AllowanceRange(rangesTransitions[1], rangesTransitions[2], value2),
                new AllowanceRange(rangesTransitions[2], rangesTransitions[3], value3)
        );
        var allowance = new MarecoAllowance(
                testContext, 0, testPath.getLength(), 30 / 3.6, ranges
        );
        var marecoEnvelope = allowance.apply(maxEffortEnvelope);
        var baseTime1 = maxEffortEnvelope.getTimeBetween(rangesTransitions[0], rangesTransitions[1]);
        var baseTime2 = maxEffortEnvelope.getTimeBetween(rangesTransitions[1], rangesTransitions[2]);
        var baseTime3 = maxEffortEnvelope.getTimeBetween(rangesTransitions[2], rangesTransitions[3]);
        var totalBaseTime = maxEffortEnvelope.getTotalTime();
        assertEquals(totalBaseTime, baseTime1 + baseTime2 + baseTime3, 3 * TIME_STEP);
        var targetTime1 = baseTime1 + value1.getAllowanceTime(baseTime1, rangesTransitions[1] - rangesTransitions[0]);
        var targetTime2 = baseTime2 + value2.getAllowanceTime(baseTime2, rangesTransitions[2] - rangesTransitions[1]);
        var targetTime3 = baseTime3 + value3.getAllowanceTime(baseTime3, rangesTransitions[3] - rangesTransitions[2]);
        var marginTime1 = marecoEnvelope.getTimeBetween(rangesTransitions[0], rangesTransitions[1]);
        var marginTime2 = marecoEnvelope.getTimeBetween(rangesTransitions[1], rangesTransitions[2]);
        var marginTime3 = marecoEnvelope.getTimeBetween(rangesTransitions[2], rangesTransitions[3]);
        assertEquals(marginTime1, targetTime1, 2 * TIME_STEP);
        assertEquals(marginTime2, targetTime2, 2 * TIME_STEP);
        assertEquals(marginTime3, targetTime3, 2 * TIME_STEP);
    }

    /** Test that we can add precisely the needed time in adjacent ranges */
    @Test
    public void testRangesPassageTime() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var length = 90_000;
        var testPath = new FlatPath(length, 0);
        var testContext = EnvelopeSimContext.build(testRollingStock, testPath, TIME_STEP, Comfort.STANDARD);
        var stops = new double[] { testPath.getLength() };
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 100, stops);
        var value1 = new AllowanceValue.FixedTime(50);
        var value2 = new AllowanceValue.FixedTime(60);
        var value3 = new AllowanceValue.FixedTime(80);
        var rangesTransitions = new double[] { 0, 30_000, 60_000, length };
        var ranges = List.of(
                new AllowanceRange(rangesTransitions[0], rangesTransitions[1], value1),
                new AllowanceRange(rangesTransitions[1], rangesTransitions[2], value2),
                new AllowanceRange(rangesTransitions[2], rangesTransitions[3], value3)
        );
        var allowance = new MarecoAllowance(
                testContext, 0, testPath.getLength(), 1, ranges
        );
        var marecoEnvelope = allowance.apply(maxEffortEnvelope);

        // Check that we lose as much time as specified
        assertEquals(
                maxEffortEnvelope.interpolateTotalTime(rangesTransitions[1]) + value1.time,
                marecoEnvelope.interpolateTotalTime(rangesTransitions[1]),
                2 * TIME_STEP
        );
        assertEquals(
                maxEffortEnvelope.interpolateTotalTime(rangesTransitions[2]) + value1.time + value2.time,
                marecoEnvelope.interpolateTotalTime(rangesTransitions[2]),
                2 * TIME_STEP
        );
        assertEquals(
                maxEffortEnvelope.interpolateTotalTime(rangesTransitions[3]) + value1.time + value2.time + value3.time,
                marecoEnvelope.interpolateTotalTime(rangesTransitions[3]),
                2 * TIME_STEP
        );

        // Checks that we don't accelerate to match the original speed for transitions
        assertTrue(marecoEnvelope.interpolateSpeed(rangesTransitions[1])
                < maxEffortEnvelope.interpolateSpeed(rangesTransitions[1]));
        assertTrue(marecoEnvelope.interpolateSpeed(rangesTransitions[2])
                < maxEffortEnvelope.interpolateSpeed(rangesTransitions[2]));
    }

    /** Test ranges with intersections being precisely on a stop point */
    @Test
    public void testRangesOnStopPoint() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var length = 100_000;
        var testPath = new FlatPath(length, 0);
        var testContext = EnvelopeSimContext.build(testRollingStock, testPath, TIME_STEP, Comfort.STANDARD);
        var stops = new double[] { 50000, testPath.getLength() };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var value1 = new AllowanceValue.TimePerDistance(5.5);
        var value2 = new AllowanceValue.Percentage(10);
        var rangesTransitions = new double[] { 0, 50_000, length };
        var ranges = List.of(
                new AllowanceRange(rangesTransitions[0], rangesTransitions[1], value1),
                new AllowanceRange(rangesTransitions[1], rangesTransitions[2], value2)
        );
        var allowance = new MarecoAllowance(
                testContext, 0, testPath.getLength(), 30 / 3.6, ranges
        );
        var marecoEnvelope = allowance.apply(maxEffortEnvelope);
        var baseTime1 = maxEffortEnvelope.getTimeBetween(rangesTransitions[0], rangesTransitions[1]);
        var baseTime2 = maxEffortEnvelope.getTimeBetween(rangesTransitions[1], rangesTransitions[2]);
        var totalBaseTime = maxEffortEnvelope.getTotalTime();
        assertEquals(totalBaseTime, baseTime1 + baseTime2, 3 * TIME_STEP);
        var targetTime1 = baseTime1 + value1.getAllowanceTime(baseTime1, rangesTransitions[1] - rangesTransitions[0]);
        var targetTime2 = baseTime2 + value2.getAllowanceTime(baseTime2, rangesTransitions[2] - rangesTransitions[1]);
        var marginTime1 = marecoEnvelope.getTimeBetween(rangesTransitions[0], rangesTransitions[1]);
        var marginTime2 = marecoEnvelope.getTimeBetween(rangesTransitions[1], rangesTransitions[2]);
        assertEquals(marginTime1, targetTime1, 2 * TIME_STEP);
        assertEquals(marginTime2, targetTime2, 2 * TIME_STEP);
    }

    /** Test with a very short range */
    @Test
    public void testVeryShortRange() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var length = 100_000;
        var testPath = new FlatPath(length, 0);
        var testContext = EnvelopeSimContext.build(testRollingStock, testPath, TIME_STEP, Comfort.STANDARD);
        var stops = new double[] { testPath.getLength() };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var value1 = new AllowanceValue.Percentage(5);
        var value2 = new AllowanceValue.Percentage(20);
        var value3 = new AllowanceValue.Percentage(10);
        var rangesTransitions = new double[] { 0, 30_000, 30_500, length };
        var ranges = List.of(
                new AllowanceRange(rangesTransitions[0], rangesTransitions[1], value1),
                new AllowanceRange(rangesTransitions[1], rangesTransitions[2], value2),
                new AllowanceRange(rangesTransitions[2], rangesTransitions[3], value3)
        );
        var allowance = new MarecoAllowance(
                testContext, 0, testPath.getLength(), 30 / 3.6, ranges
        );
        var marecoEnvelope = allowance.apply(maxEffortEnvelope);
        var baseTime1 = maxEffortEnvelope.getTimeBetween(rangesTransitions[0], rangesTransitions[1]);
        var baseTime2 = maxEffortEnvelope.getTimeBetween(rangesTransitions[1], rangesTransitions[2]);
        var baseTime3 = maxEffortEnvelope.getTimeBetween(rangesTransitions[2], rangesTransitions[3]);
        var totalBaseTime = maxEffortEnvelope.getTotalTime();
        assertEquals(totalBaseTime, baseTime1 + baseTime2 + baseTime3, 3 * TIME_STEP);
        var targetTime1 = baseTime1 + value1.getAllowanceTime(baseTime1, rangesTransitions[1] - rangesTransitions[0]);
        var targetTime2 = baseTime2 + value2.getAllowanceTime(baseTime2, rangesTransitions[2] - rangesTransitions[1]);
        var targetTime3 = baseTime3 + value3.getAllowanceTime(baseTime3, rangesTransitions[3] - rangesTransitions[2]);
        var marginTime1 = marecoEnvelope.getTimeBetween(rangesTransitions[0], rangesTransitions[1]);
        var marginTime2 = marecoEnvelope.getTimeBetween(rangesTransitions[1], rangesTransitions[2]);
        var marginTime3 = marecoEnvelope.getTimeBetween(rangesTransitions[2], rangesTransitions[3]);
        assertEquals(marginTime1, targetTime1, 2 * TIME_STEP);
        assertEquals(marginTime2, targetTime2, 2 * TIME_STEP);
        assertEquals(marginTime3, targetTime3, 2 * TIME_STEP);
    }

    /** Test with an allowance range that starts very slightly after the path start, and ends around the end
     * of the acceleration part. This doesn't necessarily have to result in a valid envelope as we're very close
     * to asking for an impossible allowance, but we check that it doesn't crash early */
    @Test
    public void testAllowanceRangeEdgeCase() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var length = 100_000;
        var testPath = new FlatPath(length, 0);
        var testContext = EnvelopeSimContext.build(testRollingStock, testPath, TIME_STEP, Comfort.STANDARD);
        var stops = new double[] { testPath.getLength() };
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 10, stops);
        var value1 = new AllowanceValue.Percentage(10);
        var rangesTransitions = new double[] { 0.1, maxEffortEnvelope.get(0).getEndPos() };
        var ranges = List.of(
                new AllowanceRange(rangesTransitions[0], rangesTransitions[1], value1)
        );
        var allowance = new LinearAllowance(
                testContext, rangesTransitions[0], rangesTransitions[1], 0, ranges
        );
        applyAllowanceIgnoringUserError(allowance, maxEffortEnvelope);
    }

    /** Test with an allowance range that starts very slightly after the path start, and ends around the end
     * of the acceleration part, with a large time step.
     * This doesn't necessarily have to result in a valid envelope as we're very close
     * to asking for an impossible allowance, but we check that it doesn't crash early */
    @Test
    public void testAllowanceRangeEdgeCaseLargeTimeStep() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var length = 100_000;
        var testPath = new FlatPath(length, 0);
        var testContext = EnvelopeSimContext.build(testRollingStock, testPath, TIME_STEP * 2, Comfort.STANDARD);
        var stops = new double[] { testPath.getLength() };
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 10, stops);
        var value1 = new AllowanceValue.Percentage(10);
        var rangesTransitions = new double[] { 0.1, maxEffortEnvelope.get(0).getEndPos() };
        var ranges = List.of(
                new AllowanceRange(rangesTransitions[0], rangesTransitions[1], value1)
        );
        var allowance = new LinearAllowance(
                testContext, rangesTransitions[0], rangesTransitions[1], 0, ranges
        );
        applyAllowanceIgnoringUserError(allowance, maxEffortEnvelope);
    }

    /** Applies the allowance to the envelope. Any user error (impossible margin) is ignored */
    private void applyAllowanceIgnoringUserError(Allowance allowance, Envelope envelope) {
        try {
            allowance.apply(envelope);
        } catch (AllowanceConvergenceException e) {
            assertEquals(OSRDError.ErrorCause.USER, e.cause);
        }
    }
}