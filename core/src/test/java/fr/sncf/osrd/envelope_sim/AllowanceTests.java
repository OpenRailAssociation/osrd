package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope.EnvelopeShape.*;
import static fr.sncf.osrd.envelope.EnvelopeShape.DECREASING;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeTest.makeComplexMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeTest.makeSimpleMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.MaxSpeedEnvelopeTest.TIME_STEP;
import static fr.sncf.osrd.envelope_sim.allowances.AllowanceDistribution.TIME_RATIO;
import static org.junit.jupiter.api.Assertions.*;

import com.carrotsearch.hppc.DoubleArrayList;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeShape;
import fr.sncf.osrd.envelope.EnvelopeTransitions;
import fr.sncf.osrd.envelope_sim.allowances.AllowanceDistribution;
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

public class AllowanceTests {

    private Envelope makeSimpleMarecoEnvelope(
            PhysicsRollingStock rollingStock,
            PhysicsPath path,
            double speed,
            AllowanceValue value
    ) {
        var stops = new double[] { 6000, path.getLength() };
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(rollingStock, path, speed, stops);
        var allowance = new MarecoAllowance(
                rollingStock, path, TIME_STEP, 0, path.getLength(), 0, value);
        return allowance.apply(maxEffortEnvelope, stops);
    }

    @Test
    public void testMarecoFlat() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(10000, 0);
        var marecoEnvelope = makeSimpleMarecoEnvelope(
                testRollingStock, testPath, 44.4, new AllowanceValue.Percentage(TIME_RATIO, 10));
        EnvelopeShape.check(marecoEnvelope, INCREASING, DECREASING, DECREASING, INCREASING, DECREASING, DECREASING);
        var delta = 2 * marecoEnvelope.getMaxSpeed() * TIME_STEP;
        // don't modify these values, they have been calculated with a 0.1s timestep so they can be considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(marecoEnvelope, delta, 1411, 5094, 6000, 6931, 9339);
        assertTrue(marecoEnvelope.continuous);
    }

    @Test
    public void testMarecoSteep() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(10000, 20);
        var marecoEnvelope = makeSimpleMarecoEnvelope(
                testRollingStock, testPath, 44.4, new AllowanceValue.Percentage(TIME_RATIO, 10));
        EnvelopeShape.check(marecoEnvelope,
                INCREASING, CONSTANT, DECREASING, DECREASING, INCREASING, CONSTANT, DECREASING, DECREASING);
        var delta = 2 * marecoEnvelope.getMaxSpeed() * TIME_STEP;
        // don't modify these values, they have been calculated with a 0.1s timestep so they can be considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(marecoEnvelope, delta, 1839, 4351, 5747, 6000, 7259, 8764, 9830);
        assertTrue(marecoEnvelope.continuous);
    }

    /** Test mareco with percentage time allowance */
    @ParameterizedTest
    @ValueSource(doubles = {0.0, 10, 100})
    public void testMarecoAllowance(double value) {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(100000, 0);
        var stops = new double[] { 50000, testPath.getLength() };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testRollingStock, testPath, stops);
        var allowanceValue = new AllowanceValue.Percentage(TIME_RATIO, value);
        var allowance = new MarecoAllowance(testRollingStock, testPath, TIME_STEP,
                0, testPath.getLength(), 0, allowanceValue);
        var marecoEnvelope = allowance.apply(maxEffortEnvelope, stops);
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
        var stops = new double[] { 50000, testPath.getLength() };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testRollingStock, testPath, stops);
        var allowanceValue = new AllowanceValue.TimePerDistance(TIME_RATIO, value);
        var allowance = new MarecoAllowance(testRollingStock, testPath, TIME_STEP,
                0, testPath.getLength(), 0, allowanceValue);
        var marecoEnvelope = allowance.apply(maxEffortEnvelope, stops);
        var baseTime = maxEffortEnvelope.getTotalTime();
        var distance = allowance.sectionEnd - allowance.sectionBegin;
        var targetTime = baseTime + allowanceValue.getAllowanceTime(baseTime, distance);
        var marginTime = marecoEnvelope.getTotalTime();
        assertEquals(marginTime, targetTime, 2 * TIME_STEP);
    }

    private Envelope makeSimpleConstructionEnvelope(
            PhysicsRollingStock rollingStock,
            PhysicsPath path,
            double[] stops,
            double speed,
            double begin,
            double end,
            AllowanceValue value
    ) {
        double capacitySpeedLimit = 30 / 3.6;
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(rollingStock, path, speed, stops);
        var allowance = new MarecoAllowance(rollingStock, path, TIME_STEP, begin, end, capacitySpeedLimit, value);
        return allowance.apply(maxEffortEnvelope, stops);
    }

    @Test
    public void testConstructionFlat() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(10000, 0);
        var stops = new double[] { testPath.getLength() };
        var constructionEnvelope = makeSimpleConstructionEnvelope(
                testRollingStock, testPath, stops, 44.4, 1000, 5000, new AllowanceValue.FixedTime(TIME_RATIO, 60));
        EnvelopeShape.check(constructionEnvelope,
                INCREASING, DECREASING, CONSTANT, INCREASING, CONSTANT, DECREASING);
        var delta = 2 * constructionEnvelope.getMaxSpeed() * TIME_STEP;
        // don't modify these values, they have been calculated with a 0.1s timestep so they can be considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(constructionEnvelope, delta, 1000, 1503, 2640, 5000, 8029);
        assertTrue(constructionEnvelope.continuous);
    }

    @Test
    public void testConstructionSteep() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(10000, 20);
        var stops = new double[] { 8000, testPath.getLength() };
        var constructionEnvelope = makeSimpleConstructionEnvelope(
                testRollingStock, testPath, stops, 44.4, 1500, 6500, new AllowanceValue.FixedTime(TIME_RATIO, 60));
        EnvelopeShape.check(constructionEnvelope,
                INCREASING, DECREASING, CONSTANT, INCREASING, DECREASING, INCREASING, DECREASING);
        var delta = 2 * constructionEnvelope.getMaxSpeed() * TIME_STEP;
        // don't modify these values, they have been calculated with a 0.1s timestep so they can be considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(constructionEnvelope, delta, 1500, 1803, 3356, 6500, 8000, 9356);
        assertTrue(constructionEnvelope.continuous);
    }

    /** Test construction with fixed time allowance on a segment */
    @ParameterizedTest
    @ValueSource(doubles = {0.0, 60, 200})
    public void testConstructionAllowance(double value) {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(100_000, 0);
        double capacitySpeedLimit = 30 / 3.6;
        double begin = 0;
        double end = testPath.getLength();
        final double tolerance = 0.02; // percentage
        var stops = new double[] { 50000, testPath.getLength() };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testRollingStock, testPath, stops);
        var allowanceValue = new AllowanceValue.FixedTime(TIME_RATIO, value);
        var allowance = new MarecoAllowance(testRollingStock, testPath, TIME_STEP,
                begin, end, capacitySpeedLimit, allowanceValue);
        var constructionEnvelope = allowance.apply(maxEffortEnvelope, stops);
        var baseTime = maxEffortEnvelope.getTotalTime();
        var distance = end - begin;
        var targetTime = baseTime + allowanceValue.getAllowanceTime(baseTime, distance);
        var marginTime = constructionEnvelope.getTotalTime();
        assertEquals(marginTime, targetTime, 2 * TIME_STEP);

        var speedFirstPointBase = maxEffortEnvelope.interpolateSpeed(begin);
        var speedSecondPointBase = maxEffortEnvelope.interpolateSpeed(end);

        var speedFirstPoint = constructionEnvelope.interpolateSpeed(begin);
        var speedSecondPoint = constructionEnvelope.interpolateSpeed(end);

        // make sure begin and end have the same speed before and after margin
        assertEquals(speedFirstPointBase, speedFirstPoint, speedFirstPointBase * tolerance);
        assertEquals(speedSecondPointBase, speedSecondPoint, speedSecondPointBase * tolerance);
    }

    /** Test construction with fixed time allowance on a segment */
    @ParameterizedTest
    @ValueSource(doubles = {0.0, 60, 200})
    public void testConstructionAllowanceOnSegment(double value) {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(100_000, 0);
        double capacitySpeedLimit = 30 / 3.6;
        double begin = 20_000;
        double end = 40_000;
        final double tolerance = 0.02; // percentage
        var stops = new double[] { 2_000, 50_000, testPath.getLength() };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testRollingStock, testPath, stops);
        var allowanceValue = new AllowanceValue.FixedTime(TIME_RATIO, value);
        var allowance = new MarecoAllowance(testRollingStock, testPath, TIME_STEP,
                begin, end, capacitySpeedLimit, allowanceValue);
        var constructionEnvelope = allowance.apply(maxEffortEnvelope, stops);
        var baseTime = maxEffortEnvelope.getTotalTime();
        var distance = end - begin;
        var targetTime = baseTime + allowanceValue.getAllowanceTime(baseTime, distance);
        var marginTime = constructionEnvelope.getTotalTime();
        assertEquals(marginTime, targetTime, 2 * TIME_STEP);

        var timeFirstPointBase = maxEffortEnvelope.interpolateTotalTime(begin);
        var timeSecondPointBase = maxEffortEnvelope.interpolateTotalTime(end);

        var timeFirstPoint = constructionEnvelope.interpolateTotalTime(begin);
        var timeSecondPoint = constructionEnvelope.interpolateTotalTime(end);
        var expectedTimeSecondPoint = timeSecondPointBase
                + allowanceValue.getAllowanceTime(baseTime, distance);

        // make sure begin has the same time before and after margin, and that end is offset by the proper value
        assertEquals(timeFirstPointBase, timeFirstPoint, 5 * TIME_STEP);
        assertEquals(expectedTimeSecondPoint, timeSecondPoint, 5 * TIME_STEP);

        var speedFirstPointBase = maxEffortEnvelope.interpolateSpeed(begin);
        var speedSecondPointBase = maxEffortEnvelope.interpolateSpeed(end);

        var speedFirstPoint = constructionEnvelope.interpolateSpeed(begin);
        var speedSecondPoint = constructionEnvelope.interpolateSpeed(end);

        // make sure begin and end have the same speed before and after margin
        assertEquals(speedFirstPointBase, speedFirstPoint, speedFirstPointBase * tolerance);
        assertEquals(speedSecondPointBase, speedSecondPoint, speedSecondPointBase * tolerance);
    }

    /** Test the construction margin with a high value on a small segment, expecting to get an error */
    @Test
    public void testImpossibleConstructionMargin() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(100_000, 0);
        double capacitySpeedLimit = 30 / 3.6;
        double begin = 20_000;
        double end = 40_000;
        var stops = new double[] { 50_000, testPath.getLength() };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testRollingStock, testPath, stops);
        var allowanceValue = new AllowanceValue.FixedTime(TIME_RATIO, 20_000);
        var allowance = new MarecoAllowance(testRollingStock, testPath, TIME_STEP,
                begin, end, capacitySpeedLimit, allowanceValue);

        var thrown = assertThrows(RuntimeException.class, () -> allowance.apply(maxEffortEnvelope, stops));

        assertEquals("mareco simulation did not converge", thrown.getMessage());
    }

    @Test
    @Disabled("This test fails because of: https://github.com/DGEXSolutions/osrd/issues/574")
    public void testConstructionOnMarecoAllowance() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(100_000, 0);
        double capacitySpeedLimit = 30 / 3.6;
        double begin = 30_000;
        double end = 50_000;
        var stops = new double[] { 50_000, testPath.getLength() };
        // put mareco allowance
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testRollingStock, testPath, stops);
        var marecoAllowanceValue = new AllowanceValue.Percentage(TIME_RATIO, 10);
        var marecoAllowance = new MarecoAllowance(testRollingStock, testPath, TIME_STEP,
                0, testPath.getLength(), 0, marecoAllowanceValue);
        var marecoDistance = marecoAllowance.sectionEnd - marecoAllowance.sectionBegin;
        var marecoEnvelope = marecoAllowance.apply(maxEffortEnvelope, stops);
        // put construction allowance
        var constructionAllowanceValue = new AllowanceValue.FixedTime(TIME_RATIO, 30);
        var constructionAllowance = new MarecoAllowance(testRollingStock, testPath, TIME_STEP,
                begin, end, capacitySpeedLimit, constructionAllowanceValue);
        var constructionEnvelope = constructionAllowance.apply(marecoEnvelope, stops);
        // compare the results
        var baseTime = maxEffortEnvelope.getTotalTime();
        var constructionDistance = end - begin;
        var constructionAllowanceTime =
                constructionAllowanceValue.getAllowanceTime(baseTime, constructionDistance);
        var marecoAllowanceTime = marecoAllowanceValue.getAllowanceTime(baseTime, marecoDistance);
        var targetTime = baseTime + marecoAllowanceTime + constructionAllowanceTime;
        var marginTime = constructionEnvelope.getTotalTime();
        assertEquals(marginTime, targetTime, 2 * TIME_STEP);
    }

    /** Test several construction allowances on segments */
    @Test
    public void testSeveralConstructionAllowances() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(100000, 0);
        double capacitySpeedLimit = 30 / 3.6;
        var firstAllowanceBegin = 0.;
        var firstAllowanceEnd = 50000;
        var fistAllowanceValue = new AllowanceValue.FixedTime(TIME_RATIO, 15);
        var secondAllowanceBegin = 50000;
        var secondAllowanceEnd = testPath.getLength();
        var secondAllowanceValue = new AllowanceValue.FixedTime(TIME_RATIO, 30);
        var stops = new double[] { 50_000, testPath.getLength() };

        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testRollingStock, testPath, stops);
        var firstAllowance = new MarecoAllowance(testRollingStock, testPath, TIME_STEP,
                firstAllowanceBegin, firstAllowanceEnd, capacitySpeedLimit, fistAllowanceValue);
        var fistConstructionEnvelope = firstAllowance.apply(maxEffortEnvelope, stops);
        var secondAllowance = new MarecoAllowance(testRollingStock, testPath, TIME_STEP,
                secondAllowanceBegin, secondAllowanceEnd, capacitySpeedLimit, secondAllowanceValue);
        var secondConstructionEnvelope = secondAllowance.apply(fistConstructionEnvelope, stops);
        var baseTime = maxEffortEnvelope.getTotalTime();
        var firstDistance = firstAllowanceEnd - firstAllowanceBegin;
        var secondDistance = secondAllowanceEnd - secondAllowanceBegin;
        var targetTime = baseTime + fistAllowanceValue.getAllowanceTime(baseTime, firstDistance)
                + secondAllowanceValue.getAllowanceTime(baseTime, secondDistance);
        var marginTime = secondConstructionEnvelope.getTotalTime();
        assertEquals(marginTime, targetTime, 2 * TIME_STEP);
    }

    /** Test mareco with different slopes*/
    @ParameterizedTest
    @ValueSource(ints = {0, 1, 2, 3, 4, 5, 6, 7})
    public void testDifferentSlopes(int slopeProfile) {
        // inputs
        double[] gradeValues;
        double[] gradePositions;
        switch (slopeProfile) {
            case 0: // no slope / ramp
                gradePositions = new double[]{0, 100000};
                gradeValues = new double[]{0};
                break;
            case 1: // ramp
                gradePositions = new double[]{0, 100000};
                gradeValues = new double[]{10};
                break;
            case 2: // low slope
                gradePositions = new double[]{0, 100000};
                gradeValues = new double[]{-2};
                break;
            case 3: // high slope
                gradePositions = new double[]{0, 100000};
                gradeValues = new double[]{-10};
                break;
            case 4: // high slope on a short segment
                gradePositions = new double[]{0, 50000, 60000, 100000};
                gradeValues = new double[]{0, -10, 0};
                break;
            case 5: // high slope on half
                gradePositions = new double[]{0, 50000, 100000};
                gradeValues = new double[]{0, -10};
                break;
            case 6: // high slope on acceleration
                gradePositions = new double[]{0, 10000, 100000};
                gradeValues = new double[]{-10, 0};
                break;
            case 7: // plenty of different slopes
                gradePositions = new double[]{0, 30000, 31000, 32000, 35000, 40000, 50000, 70000, 75000, 100000};
                gradeValues = new double[]{0, -20, 10, -15, 5, -2, 0, -10, 10};
                break;
            default:
                throw new RuntimeException("Unable to handle this parameter in testDifferentSlopes");
        }

        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var pathLength = 100_000;
        var testPath = new EnvelopePath(pathLength, gradePositions, gradeValues);
        var stops = new double[] { 50_000, pathLength };

        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testRollingStock, testPath, stops);
        var allowanceValue = new AllowanceValue.Percentage(TIME_RATIO, 40);
        var allowance = new MarecoAllowance(testRollingStock, testPath, TIME_STEP,
                0, testPath.getLength(), 0, allowanceValue);
        var marecoEnvelope = allowance.apply(maxEffortEnvelope, stops);

        var baseTime = maxEffortEnvelope.getTotalTime();
        var targetTime = baseTime + allowanceValue.getAllowanceTime(baseTime, pathLength);
        var marginTime = marecoEnvelope.getTotalTime();
        assertEquals(marginTime, targetTime, 2 * TIME_STEP);
    }

    /** Test mareco with different slopes*/
    @Test
    public void testAcceleratingSlopes() {
        double pathLength = 100_000;
        var gradeValues = new DoubleArrayList();
        var gradePositions = new DoubleArrayList();

        for (double begin = 0; begin + 30 < pathLength; begin += 40) {
            gradePositions.add(begin);
            gradeValues.add(-10.0);
            gradePositions.add(begin + 10);
            gradeValues.add(0.0);
            gradePositions.add(begin + 20);
            gradeValues.add(10.0);
            gradePositions.add(begin + 30);
            gradeValues.add(0.0);
        }
        gradePositions.add(pathLength);
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new EnvelopePath(pathLength, gradePositions.toArray(), gradeValues.toArray());
        var stops = new double[] { 50_000, pathLength };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testRollingStock, testPath, stops);
        var allowanceValue = new AllowanceValue.Percentage(TIME_RATIO, 10);
        var allowance = new MarecoAllowance(testRollingStock, testPath, TIME_STEP,
                0, testPath.getLength(), 0, allowanceValue);
        var marecoEnvelope = allowance.apply(maxEffortEnvelope, stops);
        var baseTime = maxEffortEnvelope.getTotalTime();
        var targetTime = baseTime + allowanceValue.getAllowanceTime(baseTime, pathLength);
        var marginTime = marecoEnvelope.getTotalTime();
        assertEquals(marginTime, targetTime, 2 * TIME_STEP);
    }
}
