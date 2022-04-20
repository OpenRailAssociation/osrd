package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope.EnvelopeShape.*;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeTest.makeComplexMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeTest.makeSimpleMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.MaxSpeedEnvelopeTest.TIME_STEP;
import static fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceDistribution.DISTANCE_RATIO;
import static fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceDistribution.TIME_RATIO;
import static org.junit.jupiter.api.Assertions.*;

import com.carrotsearch.hppc.DoubleArrayList;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeShape;
import fr.sncf.osrd.envelope.EnvelopeTransitions;
import fr.sncf.osrd.envelope_sim.allowances.AbstractAllowanceWithRanges;
import fr.sncf.osrd.envelope_sim.allowances.Allowance;
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceConvergenceException;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.exceptions.OSRDError;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.List;

public class AllowanceTests {

    private static EnvelopeSimContext makeSimpleContext(double length, double slope) {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(length, slope);
        return new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP);
    }

    private static MarecoAllowance makeMarecoAllowance(
            EnvelopeSimContext context, 
            double beginPos, double endPos,
            double capacitySpeedLimit,
            AllowanceValue value
    ) {
        var defaultRange = List.of(new AllowanceRange(beginPos, endPos, value));
        return new MarecoAllowance(context, beginPos, endPos, capacitySpeedLimit, defaultRange);
    }

    private static LinearAllowance makeLinearAllowance(
            EnvelopeSimContext context,
            double beginPos, double endPos,
            double capacitySpeedLimit,
            AllowanceValue value
    ) {
        var defaultRange = List.of(new AllowanceRange(beginPos, endPos, value));
        return new LinearAllowance(context, beginPos, endPos, capacitySpeedLimit, defaultRange);
    }

    private static Envelope makeSimpleAllowanceEnvelope(EnvelopeSimContext context,
                                                        Allowance allowance,
                                                        double speed,
                                                        boolean stop) {
        var path = context.path;
        double[] stops;
        if (stop)
            stops = new double[] { 6000, path.getLength() };
        else
            stops = new double[] { path.getLength() };
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(context, speed, stops);
        return allowance.apply(maxEffortEnvelope);
    }

    /** Test the continuity of the binary search */
    private void testBinarySearchContinuity(Envelope maxEffortEnvelope,
                                            AbstractAllowanceWithRanges allowance,
                                            double lowSpeed,
                                            double highSpeed) {
        var iteration = allowance.computeIteration(maxEffortEnvelope, lowSpeed);
        var speedFactor = 1.001;
        var previousTime = iteration.getTotalTime();
        for (double speed = lowSpeed; speed < highSpeed; speed *= speedFactor) {
            iteration = allowance.computeIteration(maxEffortEnvelope, speed);
            var iterationTime = iteration.getTotalTime();
            assertEquals(iterationTime, previousTime, previousTime * speedFactor);
            previousTime = iterationTime;
        }
    }

    @Test
    public void testBinarySearchContinuity() {
        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 0.5 * length, length };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var allowanceValue = new AllowanceValue.Percentage(TIME_RATIO, 10);

        // test mareco allowance
        var marecoAllowance = makeMarecoAllowance(
                testContext,
                0, length, 0, allowanceValue);
        testBinarySearchContinuity(maxEffortEnvelope, marecoAllowance, 10, 80);

        // test linear allowance
        var linearAllowance = makeLinearAllowance(
                testContext,
                0, length, 0, allowanceValue);
        testBinarySearchContinuity(maxEffortEnvelope, linearAllowance, 8, 70);
    }

    private void testAllowanceShapeFlat(EnvelopeSimContext context, Allowance allowance) {
        var allowanceEnvelope = makeSimpleAllowanceEnvelope(
                context, allowance, 44.4, true);
        EnvelopeShape.check(allowanceEnvelope, INCREASING, DECREASING, DECREASING, INCREASING, DECREASING, DECREASING);
        var delta = 2 * allowanceEnvelope.getMaxSpeed() * TIME_STEP;
        // don't modify these values, they have been calculated with a 0.1s time step, so they can be considered as
        // reference, the delta is supposed to absorb the difference for higher time steps
        EnvelopeTransitions.checkPositions(allowanceEnvelope, delta, 1411, 5094, 6000, 6931, 9339);
        assertTrue(allowanceEnvelope.continuous);
    }

    @Test
    public void testMarecoShapeFlat() {
        var length = 10_000;
        var testContext = makeSimpleContext(length, 0);
        var allowanceValue = new AllowanceValue.Percentage(TIME_RATIO, 10);
        var allowance = makeMarecoAllowance(
                testContext,
                0, length, 0, allowanceValue);
        testAllowanceShapeFlat(testContext, allowance);
    }

    private void testAllowanceShapeSteep(EnvelopeSimContext context, Allowance allowance) {
        var allowanceEnvelope = makeSimpleAllowanceEnvelope(
                context, allowance, 44.4, true);
        EnvelopeShape.check(allowanceEnvelope,
                INCREASING, CONSTANT, DECREASING, DECREASING, INCREASING, CONSTANT, DECREASING, DECREASING);
        var delta = 2 * allowanceEnvelope.getMaxSpeed() * TIME_STEP;
        // don't modify these values, they have been calculated with a 0.1s time step, so they can be considered as
        // reference, the delta is supposed to absorb the difference for higher time steps
        EnvelopeTransitions.checkPositions(allowanceEnvelope, delta, 1839, 4351, 5747, 6000, 7259, 8764, 9830);
        assertTrue(allowanceEnvelope.continuous);
    }

    @Test
    public void testMarecoShapeSteep() {
        var length = 10_000;
        var testContext = makeSimpleContext(length, 20);
        var allowanceValue = new AllowanceValue.Percentage(TIME_RATIO, 10);
        var allowance = makeMarecoAllowance(
                testContext,
                0, length, 0, allowanceValue);
        testAllowanceShapeSteep(testContext, allowance);
    }

    /** Make sure that applying the given allowance to the given base will result in the correct total time*/
    private void testAllowanceTime(Envelope base, AbstractAllowanceWithRanges allowance) {
        var allowanceEnvelope = allowance.apply(base);
        var marginTime = allowanceEnvelope.getTotalTime();
        var targetTime = allowance.getTargetTime(base);
        assertEquals(marginTime, targetTime, 2 * TIME_STEP);
    }

    private void testTransitionPoints(Envelope base, AbstractAllowanceWithRanges allowance) {

        final double tolerance = 0.02; // percentage
        var beginPos = allowance.beginPos;
        var endPos = allowance.endPos;
        var allowanceEnvelope = allowance.apply(base);

        var timeBeginPointBase = base.interpolateTotalTime(beginPos);
        var timeEndPointBase = base.interpolateTotalTime(endPos);

        var timeBeginPoint = allowanceEnvelope.interpolateTotalTime(beginPos);
        var timeEndPoint = allowanceEnvelope.interpolateTotalTime(endPos);
        var expectedTimeEndPoint = timeEndPointBase + allowance.getAddedTime(base);

        // make sure begin has the same time before and after margin, and that end is offset by the proper value
        assertEquals(timeBeginPointBase, timeBeginPoint, 5 * TIME_STEP);
        assertEquals(expectedTimeEndPoint, timeEndPoint, 5 * TIME_STEP);

        var speedBeginPointBase = base.interpolateSpeed(beginPos);
        var speedEndPointBase = base.interpolateSpeed(endPos);

        var speedBeginPoint = allowanceEnvelope.interpolateSpeed(beginPos);
        var speedEndPoint = allowanceEnvelope.interpolateSpeed(endPos);

        // make sure begin and end have the same speed before and after margin
        assertEquals(speedBeginPointBase, speedBeginPoint, speedBeginPointBase * tolerance);
        assertEquals(speedEndPointBase, speedEndPoint, speedEndPointBase * tolerance);
    }

    /** Test mareco allowance with percentage time */
    @ParameterizedTest
    @ValueSource(doubles = {0.0, 10, 100})
    public void testPercentageTimeAllowances(double value) {
        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);

        var stops = new double[] { 50_000, testContext.path.getLength() };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);

        var allowanceValue = new AllowanceValue.Percentage(TIME_RATIO, value);

        // test mareco allowance
        var marecoAllowance = makeMarecoAllowance(
                testContext,
                0, length, 0, allowanceValue);
        testAllowanceTime(maxEffortEnvelope, marecoAllowance);

        // test linear allowance
        var linearAllowance = makeLinearAllowance(
                testContext,
                0, length, 0, allowanceValue);
        testAllowanceTime(maxEffortEnvelope, linearAllowance);
    }

    /** Test mareco with a time per distance allowance */
    @ParameterizedTest
    @ValueSource(doubles = {0.0, 4.5, 5.5})
    public void testTimePerDistanceAllowances(double value) {

        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 50_000, testContext.path.getLength() };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);

        var allowanceValue = new AllowanceValue.TimePerDistance(DISTANCE_RATIO, value);

        // test mareco allowance
        var marecoAllowance = makeMarecoAllowance(
                testContext,
                0, length, 0, allowanceValue);
        testAllowanceTime(maxEffortEnvelope, marecoAllowance);

        // test linear allowance
        var linearAllowance = makeLinearAllowance(
                testContext,
                0, length, 0, allowanceValue);
        testAllowanceTime(maxEffortEnvelope, linearAllowance);
    }

    private void testConstructionAllowance(Envelope base, AbstractAllowanceWithRanges allowance) {
        testAllowanceTime(base, allowance);
        testTransitionPoints(base, allowance);
    }

    @ParameterizedTest
    @ValueSource(doubles = {0.0, 60, 200})
    public void testConstructionAllowancesFlat(double value) {
        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 50_000, length };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var allowanceValue = new AllowanceValue.FixedTime(TIME_RATIO, value);

        // test mareco allowance
        var marecoAllowance = makeMarecoAllowance(
                testContext,
                0, length, 8.33, allowanceValue);
        testConstructionAllowance(maxEffortEnvelope, marecoAllowance);

        // test linear allowance
        var linearAllowance = makeLinearAllowance(
                testContext,
                0, length, 8.33, allowanceValue);
        testConstructionAllowance(maxEffortEnvelope, linearAllowance);
    }

    @ParameterizedTest
    @ValueSource(doubles = {0.0, 60, 200})
    public void testConstructionAllowancesSteep(double value) {
        var length = 100_000;
        var testContext = makeSimpleContext(length, 20);
        var stops = new double[] { 50000, length };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var allowanceValue = new AllowanceValue.FixedTime(TIME_RATIO, value);

        // test mareco allowance
        var marecoAllowance = makeMarecoAllowance(
                testContext,
                0, length, 8.33, allowanceValue);
        testConstructionAllowance(maxEffortEnvelope, marecoAllowance);

        // test linear allowance
        var linearAllowance = makeLinearAllowance(
                testContext,
                0, length, 8.33, allowanceValue);
        testConstructionAllowance(maxEffortEnvelope, linearAllowance);
    }

    /** Test construction with fixed time allowance on a segment */
    @ParameterizedTest
    @ValueSource(doubles = {0.0, 60, 200})
    public void testConstructionAllowancesOnSegment(double value) {

        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 2_000, 50_000, length };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var allowanceValue = new AllowanceValue.FixedTime(TIME_RATIO, value);
        double begin = 20_000;
        double end = 40_000;

        // test mareco allowance
        var marecoAllowance = makeMarecoAllowance(
                testContext,
                begin, end, 8.33, allowanceValue);
        testConstructionAllowance(maxEffortEnvelope, marecoAllowance);

        // test linear allowance
        var linearAllowance = makeLinearAllowance(
                testContext,
                begin, end, 8.33, allowanceValue);
        testConstructionAllowance(maxEffortEnvelope, linearAllowance);
    }

    /** Test the construction margin with a high value on a short segment, expecting to get an error */
    @Test
    public void testImpossibleConstructionAllowances() {
        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 50_000, length };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var allowanceValue = new AllowanceValue.FixedTime(TIME_RATIO, 20_000);
        double begin = 20_000;
        double end = 40_000;

        // test mareco allowance
        var marecoAllowance = makeMarecoAllowance(
                testContext, begin, end, 8.33, allowanceValue);
        var marecoThrown =
                assertThrows(AllowanceConvergenceException.class, () -> marecoAllowance.apply(maxEffortEnvelope));
        assertEquals("too_much_allowance_time", marecoThrown.errorType);

        // test linear allowance
        var linearAllowance = makeLinearAllowance(
                testContext, begin, end, 8.33, allowanceValue);
        var linearThrown =
                assertThrows(AllowanceConvergenceException.class, () -> linearAllowance.apply(maxEffortEnvelope));
        assertEquals("too_much_allowance_time", linearThrown.errorType);
    }

    /** Test the construction margin with a very short segment, to trigger intersectLeftRightParts method */
    @Test
    public void testIntersectLeftRightParts() {
        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 50_000, length };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var allowanceValue = new AllowanceValue.FixedTime(TIME_RATIO, 20);
        double begin = 20_000;
        double end = 21_000;

        // test mareco allowance
        var marecoAllowance = makeMarecoAllowance(
                testContext, begin, end, 8.33, allowanceValue);
        var marecoThrown =
                assertThrows(AllowanceConvergenceException.class, () -> marecoAllowance.apply(maxEffortEnvelope));
        assertEquals("too_much_allowance_time", marecoThrown.errorType);

        // test linear allowance
        var linearAllowance = makeLinearAllowance(
                testContext, begin, end, 8.33, allowanceValue);
        var linearThrown =
                assertThrows(AllowanceConvergenceException.class, () -> linearAllowance.apply(maxEffortEnvelope));
        assertEquals("too_much_allowance_time", linearThrown.errorType);
    }

    private void testConstructionOnStandardAllowance(Envelope maxEffortEnvelope,
                                                     AbstractAllowanceWithRanges standardAllowance,
                                                     AbstractAllowanceWithRanges constructionAllowance) {
        var standardEnvelope = standardAllowance.apply(maxEffortEnvelope);
        var constructionEnvelope = constructionAllowance.apply(standardEnvelope);

        var baseTime = maxEffortEnvelope.getTotalTime();
        var standardAllowanceAddedTime = standardAllowance.getAddedTime(maxEffortEnvelope);
        var constructionAllowanceAddedTime = constructionAllowance.getAddedTime(standardEnvelope);
        var targetTime = baseTime + standardAllowanceAddedTime + constructionAllowanceAddedTime;
        var marginTime = constructionEnvelope.getTotalTime();
        assertEquals(marginTime, targetTime, 5 * TIME_STEP);

        var constructionAllowanceTargetTime = constructionAllowance.getTargetTime(standardEnvelope);
        assertEquals(marginTime, constructionAllowanceTargetTime, 5 * TIME_STEP);

    }

    @Test
    public void testConstructionOnStandardAllowances() {
        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 50_000, length };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        double begin = 30_000;
        double end = 50_000;

        var standardAllowanceValue = new AllowanceValue.Percentage(TIME_RATIO, 10);
        var constructionAllowanceValue = new AllowanceValue.FixedTime(TIME_RATIO, 30);

        // test mareco allowance
        var standardMarecoAllowance = makeMarecoAllowance(
                testContext, 0, length, 8.33, standardAllowanceValue);
        var constructionMarecoAllowance = makeMarecoAllowance(
                testContext, begin, end, 8.33, constructionAllowanceValue);
        testConstructionOnStandardAllowance(maxEffortEnvelope, standardMarecoAllowance, constructionMarecoAllowance);

        // test linear allowance
        var standardLinearAllowance = makeLinearAllowance(
                testContext, 0, length, 8.33, standardAllowanceValue);
        var constructionLinearAllowance = makeLinearAllowance(
                testContext, begin, end, 8.33, constructionAllowanceValue);
        testConstructionOnStandardAllowance(maxEffortEnvelope, standardLinearAllowance, constructionLinearAllowance);
    }

    private void testSeveralConstructionAllowances(Envelope maxEffortEnvelope,
                                                   AbstractAllowanceWithRanges allowanceA,
                                                   AbstractAllowanceWithRanges allowanceB) {
        var constructionEnvelopeA = allowanceA.apply(maxEffortEnvelope);
        var constructionEnvelopeB = allowanceB.apply(constructionEnvelopeA);
        var baseTime = maxEffortEnvelope.getTotalTime();
        var targetTime = baseTime
                + allowanceA.getAddedTime(maxEffortEnvelope)
                + allowanceB.getAddedTime(maxEffortEnvelope);
        var marginTime = constructionEnvelopeB.getTotalTime();
        assertEquals(marginTime, targetTime, 2 * TIME_STEP);
    }

    /** Test several construction allowances on segments */
    @ParameterizedTest
    @ValueSource(ints = {30_000, 50_000, 70_000})
    public void testSeveralConstructionAllowances(double value) {

        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 50_000, length };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var allowanceValueA = new AllowanceValue.FixedTime(TIME_RATIO, 15);
        var allowanceValueB = new AllowanceValue.FixedTime(TIME_RATIO, 30);

        // test mareco allowance
        var marecoAllowanceA = makeMarecoAllowance(
                testContext, 0, value, 8.33, allowanceValueA);
        var marecoAllowanceB = makeMarecoAllowance(
                testContext, value, length, 8.33, allowanceValueB);
        testSeveralConstructionAllowances(maxEffortEnvelope, marecoAllowanceA, marecoAllowanceB);

        // test linear allowance
        var linearAllowanceA = makeLinearAllowance(
                testContext, 0, value, 8.33, allowanceValueA);
        var linearAllowanceB = makeLinearAllowance(
                testContext, value, length, 8.33, allowanceValueB);
        testSeveralConstructionAllowances(maxEffortEnvelope, linearAllowanceA, linearAllowanceB);
    }

    /** Test mareco with different slopes*/
    @ParameterizedTest
    @ValueSource(ints = {0, 1, 2, 3, 4, 5, 6, 7})
    public void testDifferentSlopes(int slopeProfile) {
        // inputs
        double[] gradeValues;
        double[] gradePositions;
        switch (slopeProfile) {
            case 0 -> { // no slope / ramp
                gradePositions = new double[]{0, 100000};
                gradeValues = new double[]{0};
            }
            case 1 -> { // ramp
                gradePositions = new double[]{0, 100000};
                gradeValues = new double[]{10};
            }
            case 2 -> { // low slope
                gradePositions = new double[]{0, 100000};
                gradeValues = new double[]{-2};
            }
            case 3 -> { // high slope
                gradePositions = new double[]{0, 100000};
                gradeValues = new double[]{-10};
            }
            case 4 -> { // high slope on a short segment
                gradePositions = new double[]{0, 50000, 60000, 100000};
                gradeValues = new double[]{0, -10, 0};
            }
            case 5 -> { // high slope on half
                gradePositions = new double[]{0, 50000, 100000};
                gradeValues = new double[]{0, -10};
            }
            case 6 -> { // high slope on acceleration
                gradePositions = new double[]{0, 10000, 100000};
                gradeValues = new double[]{-10, 0};
            }
            case 7 -> { // plenty of different slopes
                gradePositions = new double[]{0, 30000, 31000, 32000, 35000, 40000, 50000, 70000, 75000, 100000};
                gradeValues = new double[]{0, -20, 10, -15, 5, -2, 0, -10, 10};
            }
            default -> throw new RuntimeException("Unable to handle this parameter in testDifferentSlopes");
        }

        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var length = 100_000;
        var testPath = new EnvelopePath(length, gradePositions, gradeValues);
        var testContext = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP);
        var stops = new double[] { 50_000, testContext.path.getLength() };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);

        var allowanceValue = new AllowanceValue.Percentage(TIME_RATIO, 40);

        // test mareco allowance
        var marecoAllowance = makeMarecoAllowance(
                testContext,
                0, length, 0, allowanceValue);
        testAllowanceTime(maxEffortEnvelope, marecoAllowance);

        // test linear allowance
        var linearAllowance = makeLinearAllowance(
                testContext,
                0, length, 0, allowanceValue);
        testAllowanceTime(maxEffortEnvelope, linearAllowance);
    }

    /** Test mareco with different accelerating slopes*/
    @Test
    public void testMarecoAcceleratingSlopes() {
        double length = 100_000;
        var gradeValues = new DoubleArrayList();
        var gradePositions = new DoubleArrayList();

        for (double begin = 0; begin + 6000 < length; begin += 8000) {
            gradePositions.add(begin);
            gradeValues.add(-10.0);
            gradePositions.add(begin + 2000);
            gradeValues.add(0.0);
            gradePositions.add(begin + 4000);
            gradeValues.add(10.0);
            gradePositions.add(begin + 6000);
            gradeValues.add(0.0);
        }
        gradePositions.add(length);

        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new EnvelopePath(length, gradePositions.toArray(), gradeValues.toArray());
        var testContext = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP);
        var stops = new double[]{ 50_000, length };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var allowanceValue = new AllowanceValue.Percentage(TIME_RATIO, 10);
        var allowance = makeMarecoAllowance(new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP),
                0, testPath.getLength(), 0, allowanceValue);
        var marecoEnvelope = allowance.apply(maxEffortEnvelope);
        var targetTime = allowance.getTargetTime(maxEffortEnvelope);
        var marginTime = marecoEnvelope.getTotalTime();
        assertEquals(marginTime, targetTime, 2 * TIME_STEP);

        // The train space-speed curve is supposed to follow this complicated shape because of the multiple
        // accelerating slopes.
        // If the test fails here, plot the curves to check if the curve makes sense and adapt the shape.
        // It is not supposed to be an absolute shape, but at least to be triggered if MARECO doesn't take into
        // account the accelerating slopes
        EnvelopeShape.check(marecoEnvelope, new EnvelopeShape[][]{
                {INCREASING}, {CONSTANT}, {DECREASING, INCREASING}, {CONSTANT}, {INCREASING}, {CONSTANT},
                {DECREASING, INCREASING}, {CONSTANT}, {DECREASING, INCREASING}, {CONSTANT},
                {DECREASING, INCREASING, DECREASING, INCREASING, DECREASING, INCREASING},
                {DECREASING}, {INCREASING}, {CONSTANT}, {INCREASING}, {INCREASING}, {CONSTANT},
                {DECREASING, INCREASING}, {CONSTANT}, {DECREASING, INCREASING, DECREASING},
                {CONSTANT}, {DECREASING, INCREASING}, {CONSTANT}, {DECREASING, INCREASING, DECREASING}, {DECREASING}
        }
        );
    }

    /** Tests allowances on a short path where we can't reach max speed,
     * we only check internal asserts (convergence, envelope asserts) */
    @Test
    public void testShortAllowances() {
        var length = 100;
        var testContext = makeSimpleContext(length, 0);
        var allowanceValue = new AllowanceValue.Percentage(TIME_RATIO, 10);

        // test mareco allowance
        var marecoAllowance = makeMarecoAllowance(
                testContext,
                0, length, 0, allowanceValue);
        makeSimpleAllowanceEnvelope(testContext, marecoAllowance, 100, false);

        // test linear allowance
        var linearAllowance = makeLinearAllowance(
                testContext,
                0, length, 0, allowanceValue);
        makeSimpleAllowanceEnvelope(testContext, linearAllowance, 100, false);
    }

    /** Test allowance starting in a deceleration section */
    @Test
    public void testAllowancesStartDeceleration() {
        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 6000, length };

        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        double start = 0;
        for (var part : maxEffortEnvelope) {
            if (part.hasAttr(EnvelopeProfile.BRAKING) && !part.hasAttr(StopMeta.class)) {
                start = (part.getBeginPos() + part.getEndPos()) / 2;
                break;
            }
        }
        assert start > 0;
        var allowanceValue = new AllowanceValue.TimePerDistance(TIME_RATIO, 10);

        // test mareco allowance
        var marecoAllowance = makeMarecoAllowance(
                testContext,
                0, length, 0, allowanceValue);
        marecoAllowance.apply(maxEffortEnvelope);

        // test linear allowance
        var linearAllowance = makeLinearAllowance(
                testContext,
                0, length, 0, allowanceValue);
        linearAllowance.apply(maxEffortEnvelope);
    }

    /** Test allowances ending in an acceleration section */
    @Test
    public void testAllowancesEndAcceleration() {
        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 6000, length };

        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        double end = 0;
        for (var part : maxEffortEnvelope) {
            if (part.hasAttr(EnvelopeProfile.ACCELERATING)) {
                end = (part.getBeginPos() + part.getEndPos()) / 2;
            }
        }
        assert end > 0;
        var allowanceValue = new AllowanceValue.TimePerDistance(TIME_RATIO, 10);

        // test mareco allowance
        var marecoAllowance = makeMarecoAllowance(
                testContext,
                0, length, 0, allowanceValue);
        marecoAllowance.apply(maxEffortEnvelope);

        // test linear allowance
        var linearAllowance = makeLinearAllowance(
                testContext,
                0, length, 0, allowanceValue);
        linearAllowance.apply(maxEffortEnvelope);
    }

    @Test
    public void testMarecoHighSlopeAtEnd() {
        var testRollingStock = TestTrains.VERY_SHORT_FAST_TRAIN;

        var length = 15000;
        var gradePositions = new double[] { 0, 7000, 8100, length };
        var gradeValues = new double[] { 0, 40, 0 };
        var testPath = new EnvelopePath(length, gradePositions, gradeValues);
        var testContext = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP);
        var stops = new double[] { length };
        var begin = 3000;
        var end = 8000;

        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 30, stops);
        var allowanceValue = new AllowanceValue.FixedTime(TIME_RATIO, 10);

        // test mareco allowance
        var marecoAllowance = makeMarecoAllowance(
                testContext,
                begin, end, 0, allowanceValue);
        marecoAllowance.apply(maxEffortEnvelope);

        // test linear allowance
        var linearAllowance = makeLinearAllowance(
                testContext,
                begin, end, 0, allowanceValue);
        linearAllowance.apply(maxEffortEnvelope);
    }

    @Test
    public void testAllowancesDiscontinuity() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;

        var length = 10000;
        var testPath = new FlatPath(length, 0);
        var testContext = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP);
        var stops = new double[] { length };
        var begin = 2000;

        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 30, stops);
        var allowanceValue = new AllowanceValue.Percentage(TIME_RATIO, 90);

        // test mareco allowance
        var marecoAllowance = makeMarecoAllowance(
                testContext,
                begin, length, 10, allowanceValue);
        marecoAllowance.apply(maxEffortEnvelope);

        // test linear allowance
        var linearAllowance = makeLinearAllowance(
                testContext,
                begin, length, 10, allowanceValue);
        linearAllowance.apply(maxEffortEnvelope);
    }

    @Test
    public void testAllowancesErrors() {
        var length = 10_000;
        var testContext = makeSimpleContext(length, 0);
        var allowanceValue = new AllowanceValue.Percentage(TIME_RATIO, 1e10);

        // test mareco allowance
        var marecoAllowance = makeMarecoAllowance(
                testContext,
                0, length, 0, allowanceValue);
        var marecoException = assertThrows(AllowanceConvergenceException.class, () ->
                makeSimpleAllowanceEnvelope(testContext, marecoAllowance, 44.4, true)
        );
        assert marecoException.errorType.equals("too_much_allowance_time");
        assert marecoException.cause == OSRDError.ErrorCause.USER;

        // test linear allowance
        var linearAllowance = makeLinearAllowance(
                testContext,
                0, length, 0, allowanceValue);
        var linearException = assertThrows(AllowanceConvergenceException.class, () ->
                makeSimpleAllowanceEnvelope(testContext, linearAllowance, 44.4, true)
        );
        assert linearException.errorType.equals("too_much_allowance_time");
        assert linearException.cause == OSRDError.ErrorCause.USER;
    }
}
