package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope.EnvelopeShape.*;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeBuilder.makeComplexMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeBuilder.makeSimpleMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.SimpleContextBuilder.TIME_STEP;
import static fr.sncf.osrd.envelope_sim.SimpleContextBuilder.makeSimpleContext;
import static org.junit.jupiter.api.Assertions.*;

import com.google.common.primitives.Doubles;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.allowances.Allowance;
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

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
        var allowance = new MarecoAllowance(0, path.getLength(), 1, ranges);
        return allowance.apply(maxEffortEnvelope, context);
    }

    public static double getDistance(MarecoAllowance allowance) {
        return allowance.endPos - allowance.beginPos;
    }

    @Test
    public void testRangesFlat() {
        var testContext = makeSimpleContext(100000, 0);
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
        var length = 100000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 50000, length };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var value1 = new AllowanceValue.Percentage(10);
        var value2 = new AllowanceValue.TimePerDistance(4.5);
        var rangesTransition = 70_000;
        var ranges = List.of(
                new AllowanceRange(0, rangesTransition, value1),
                new AllowanceRange(rangesTransition, length, value2)
        );
        var allowance = new MarecoAllowance(0, length, 30 / 3.6, ranges);
        var marecoEnvelope = allowance.apply(maxEffortEnvelope, testContext);
        var baseTime1 = maxEffortEnvelope.getTimeBetween(0, rangesTransition);
        var baseTime2 = maxEffortEnvelope.getTimeBetween(rangesTransition, length);
        var totalBaseTime = maxEffortEnvelope.getTotalTime();
        assertEquals(totalBaseTime, baseTime1 + baseTime2, 2 * TIME_STEP);
        var distance = getDistance(allowance);
        var targetTime1 = baseTime1 + value1.getAllowanceTime(baseTime1, rangesTransition);
        var targetTime2 = baseTime2 + value2.getAllowanceTime(baseTime2, distance - rangesTransition);
        var marginTime1 = marecoEnvelope.getTimeBetween(0, rangesTransition);
        var marginTime2 = marecoEnvelope.getTimeBetween(rangesTransition, length);
        assertEquals(marginTime1, targetTime1, 2 * TIME_STEP);
        assertEquals(marginTime2, targetTime2, 2 * TIME_STEP);
    }

    /** Test ranges with decreasing values */
    @Test
    public void testRangesWithDecreasingValues() {
        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 50000, length };
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
        var allowance = new MarecoAllowance(0, length, 30 / 3.6, ranges);
        var marecoEnvelope = allowance.apply(maxEffortEnvelope, testContext);
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
        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 50000, length };
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
        var allowance = new MarecoAllowance(0, length, 30 / 3.6, ranges);
        var marecoEnvelope = allowance.apply(maxEffortEnvelope, testContext);
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
        var length = 90_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { length };
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
        var allowance = new MarecoAllowance(0, length, 1, ranges);
        var marecoEnvelope = allowance.apply(maxEffortEnvelope, testContext);

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
        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 50000, length };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var value1 = new AllowanceValue.TimePerDistance(5.5);
        var value2 = new AllowanceValue.Percentage(10);
        var rangesTransitions = new double[] { 0, 50_000, length };
        var ranges = List.of(
                new AllowanceRange(rangesTransitions[0], rangesTransitions[1], value1),
                new AllowanceRange(rangesTransitions[1], rangesTransitions[2], value2)
        );
        var allowance = new MarecoAllowance(0, length, 30 / 3.6, ranges);
        var marecoEnvelope = allowance.apply(maxEffortEnvelope, testContext);
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

    /** Test arguments for @testVeryShortRange */
    public static Stream<Arguments> allowanceValues() {
        return Stream.of(
                Arguments.of(new double[]{5, 20, 10}),
                Arguments.of(new double[]{20, 5, 10}),
                Arguments.of(new double[]{5, 10, 20}),
                Arguments.of(new double[]{5, 40, 5})
        );
    }

    /** Test with a very short range */
    @ParameterizedTest
    @MethodSource("allowanceValues")
    public void testVeryShortRange(double[] allowanceValues) {
        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] {length};
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var value1 = new AllowanceValue.Percentage(allowanceValues[0]);
        var value2 = new AllowanceValue.Percentage(allowanceValues[1]);
        var value3 = new AllowanceValue.Percentage(allowanceValues[2]);
        var rangesTransitions = new double[] { 0, 30_000, 30_500, length };
        var ranges = List.of(
                new AllowanceRange(rangesTransitions[0], rangesTransitions[1], value1),
                new AllowanceRange(rangesTransitions[1], rangesTransitions[2], value2),
                new AllowanceRange(rangesTransitions[2], rangesTransitions[3], value3)
        );
        var allowance = new MarecoAllowance(0, length, 30 / 3.6, ranges);
        var marecoEnvelope = allowance.apply(maxEffortEnvelope, testContext);
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
        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { length };
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 10, stops);
        var value1 = new AllowanceValue.Percentage(10);
        var rangesTransitions = new double[] { 0.1, maxEffortEnvelope.get(0).getEndPos() };
        var ranges = List.of(
                new AllowanceRange(rangesTransitions[0], rangesTransitions[1], value1)
        );
        var allowance = new LinearAllowance(rangesTransitions[0], rangesTransitions[1], 1, ranges
        );
        applyAllowanceIgnoringUserError(allowance, maxEffortEnvelope, testContext);
    }

    /** Test with an allowance range that starts very slightly after the path start, and ends around the end
     * of the acceleration part, with a large time step.
     * This doesn't necessarily have to result in a valid envelope as we're very close
     * to asking for an impossible allowance, but we check that it doesn't crash early */
    @Test
    public void testAllowanceRangeEdgeCaseLargeTimeStep() {
        var length = 100_000;
        var testContext = makeSimpleContext(length, 0, TIME_STEP * 2);
        var stops = new double[] { length };
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 10, stops);
        var value1 = new AllowanceValue.Percentage(10);
        var rangesTransitions = new double[] { 0.1, maxEffortEnvelope.get(0).getEndPos() };
        var ranges = List.of(
                new AllowanceRange(rangesTransitions[0], rangesTransitions[1], value1)
        );
        var allowance = new LinearAllowance(rangesTransitions[0], rangesTransitions[1], 1, ranges);
        applyAllowanceIgnoringUserError(allowance, maxEffortEnvelope, testContext);
    }

    /** Regression test: reproduces <a href="https://github.com/osrd-project/osrd/issues/3199">this bug</a>.
     * This is an extreme corner case.
     * The last section computed is the section between the stop at 300m and the transition at 301.
     * Because it's after a stop, the speed is very low.
     * The capacity speed limit sets a binary search bound that is higher than the max speed on that part, resulting
     * in a linear allowance that goes faster. The transition can be weird. */
    @Test
    public void regressionTestCornerCase() {
        var testRollingStock = SimpleRollingStock.STANDARD_TRAIN;
        var testPath = new FlatPath(10_000, 0);
        var stops = new double[]{300};
        var testContext = new EnvelopeSimContext(
                testRollingStock, 
                testPath, 
                TIME_STEP,
                SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP
        );
        var allowance = new LinearAllowance(
                0,
                testPath.getLength(),
                1.5,
                List.of(
                        new AllowanceRange(0, 301, new AllowanceValue.FixedTime(50)),
                        new AllowanceRange(301, testPath.getLength(), new AllowanceValue.Percentage(50))
                )
        );
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 80, stops);
        var err = assertThrows(
                OSRDError.class,
                () -> allowance.apply(maxEffortEnvelope, testContext)
        );
        assertEquals(err.osrdErrorType, ErrorType.AllowanceConvergenceTooMuchTime);
    }

    /** This tests ensure that, even with several ranges, the error doesn't build
     * up to more than the tolerance for one binary search. */
    @ParameterizedTest
    @CsvSource({ "10, 1", "10, 11", "1, 11" })
    public void errorBuildupTest(int nRanges, int nStops) {
        var testRollingStock = SimpleRollingStock.STANDARD_TRAIN;
        var testPath = new FlatPath(10_000, 0);
        var rangeLength = testPath.getLength() / nRanges;
        var testContext = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP,
                SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP);
        var allowanceRanges = new ArrayList<AllowanceRange>();
        for (int i = 0; i < nRanges; i++) {
            allowanceRanges.add(new AllowanceRange(
                    i * rangeLength,
                    (i + 1) * rangeLength,
                    new AllowanceValue.Percentage(50)
            ));
        }
        var allowance = new LinearAllowance(
                0,
                testPath.getLength(),
                1.5,
                allowanceRanges
        );
        var stopsDistance = testPath.getLength() / nStops;
        var stops = new ArrayList<Double>();
        for (int i = 0; i < nStops; i++) {
            stops.add((i + 1) * stopsDistance);
        }
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 30, Doubles.toArray(stops));
        var res = allowance.apply(maxEffortEnvelope, testContext);
        assert res != null;
        var expectedTime = maxEffortEnvelope.getTotalTime() * 1.5;
        assertEquals(expectedTime, res.getTotalTime(), testContext.timeStep);
    }

    /** Applies the allowance to the envelope. Any user error (impossible margin) is ignored */
    private void applyAllowanceIgnoringUserError(Allowance allowance, Envelope envelope, EnvelopeSimContext context) {
        try {
            allowance.apply(envelope, context);
        } catch (OSRDError e) {
            if (e.osrdErrorType != ErrorType.AllowanceConvergenceTooMuchTime) {
                throw e;
            }
        }
    }
}
