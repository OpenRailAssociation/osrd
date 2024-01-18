package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope.EnvelopeShape.CONSTANT;
import static fr.sncf.osrd.envelope.EnvelopeShape.DECREASING;
import static fr.sncf.osrd.envelope.EnvelopeShape.INCREASING;
import static fr.sncf.osrd.envelope.EnvelopeShape.check;
import static fr.sncf.osrd.envelope_sim.EnvelopeSimPathBuilder.buildNonElectrified;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeBuilder.makeComplexMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeBuilder.makeSimpleMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.SimpleContextBuilder.TIME_STEP;
import static fr.sncf.osrd.envelope_sim.SimpleContextBuilder.makeSimpleContext;
import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.areSpeedsEqual;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.carrotsearch.hppc.DoubleArrayList;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeShape;
import fr.sncf.osrd.envelope.EnvelopeTransitions;
import fr.sncf.osrd.envelope_sim.allowances.AbstractAllowanceWithRanges;
import fr.sncf.osrd.envelope_sim.allowances.Allowance;
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.reporting.exceptions.ErrorCause;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.List;

public class AllowanceTests {
    /**
     * test allowance data
     */
    public static MarecoAllowance makeStandardMarecoAllowance(
            double beginPos, double endPos,
            double capacitySpeedLimit,
            AllowanceValue value
    ) {
        var defaultRange = List.of(new AllowanceRange(beginPos, endPos, value));
        return new MarecoAllowance(beginPos, endPos, capacitySpeedLimit, defaultRange);
    }

    private static LinearAllowance makeStandardLinearAllowance(
            double beginPos, double endPos,
            double capacitySpeedLimit,
            AllowanceValue value
    ) {
        var defaultRange = List.of(new AllowanceRange(beginPos, endPos, value));
        return new LinearAllowance(beginPos, endPos, capacitySpeedLimit, defaultRange);
    }

    /**
     * build test allowance data
     */
    public static Envelope makeSimpleAllowanceEnvelope(
            EnvelopeSimContext context,
            Allowance allowance,
            double speed,
            boolean stop
    ) {
        var path = context.path;
        double[] stops;
        if (stop)
            stops = new double[] { 6000, path.getLength() };
        else
            stops = new double[] { path.getLength() };
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(context, speed, stops);
        return allowance.apply(maxEffortEnvelope, context);
    }

    /** Test the continuity of the binary search */
    @SuppressFBWarnings("FL_FLOATS_AS_LOOP_COUNTERS")
    private void testBinarySearchContinuity(Envelope maxEffortEnvelope,
                                            AbstractAllowanceWithRanges allowance,
                                            EnvelopeSimContext context,
                                            double lowSpeed,
                                            double highSpeed) {
        // We check that when the speed parameter goes up, the speed goes up at every point of the envelope
        var previousEnvelope = allowance.computeIteration(maxEffortEnvelope, context, lowSpeed);
        var speedFactor = 1.001;
        for (double speed = lowSpeed; speed < highSpeed; speed *= speedFactor) {
            var envelope = allowance.computeIteration(maxEffortEnvelope, context, speed);
            for (var part : envelope) {
                for (int i = 0; i < part.stepCount(); i++) {
                    var position = part.getPointSpeed(i);
                    var newSpeed = envelope.interpolateSpeed(position);
                    var prevSpeed = previousEnvelope.interpolateSpeed(position);
                    assertTrue(prevSpeed < newSpeed || areSpeedsEqual(prevSpeed, newSpeed));
                }
            }
        }
    }

    @Test
    public void testBinarySearchContinuity() {
        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 0.5 * length, length };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var allowanceValue = new AllowanceValue.Percentage(10);

        // test mareco distribution
        var marecoAllowance = makeStandardMarecoAllowance(0, length, 1, allowanceValue);
        testBinarySearchContinuity(maxEffortEnvelope, marecoAllowance, testContext, 10, 80);

        // test linear distribution
        var linearAllowance = makeStandardLinearAllowance(0, length, 1, allowanceValue);
        testBinarySearchContinuity(maxEffortEnvelope, linearAllowance, testContext, 8, 70);
    }

    @Test
    public void complexTestBinarySearchContinuity() {
        var length = 50_000;
        var trainPath = buildNonElectrified(length, new double[]{0, 800, 35_000, length}, new double[]{0, 50, -10});
        var testContext = new EnvelopeSimContext(SimpleRollingStock.STANDARD_TRAIN, trainPath,
                2., SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP);
        var stops = new double[] {};
        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 44, stops);
        var allowanceValue = new AllowanceValue.Percentage(50);

        // test mareco distribution
        var marecoAllowance = makeStandardMarecoAllowance(0, 50_000, 1, allowanceValue);
        testBinarySearchContinuity(maxEffortEnvelope, marecoAllowance, testContext, 10, 80);
    }

    private void testAllowanceShapeFlat(EnvelopeSimContext context, Allowance allowance) {
        var allowanceEnvelope = makeSimpleAllowanceEnvelope(
                context, allowance, 44.4, true);
        check(allowanceEnvelope, INCREASING, DECREASING, DECREASING, INCREASING, DECREASING, DECREASING);
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
        var allowanceValue = new AllowanceValue.Percentage(10);
        var allowance = makeStandardMarecoAllowance(0, length, 1, allowanceValue);
        testAllowanceShapeFlat(testContext, allowance);
    }

    private void testAllowanceShapeSteep(EnvelopeSimContext context, Allowance allowance) {
        var allowanceEnvelope = makeSimpleAllowanceEnvelope(
                context, allowance, 44.4, true);
        check(allowanceEnvelope,
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
        var allowanceValue = new AllowanceValue.Percentage(10);
        var allowance = makeStandardMarecoAllowance(0, length, 1, allowanceValue);
        testAllowanceShapeSteep(testContext, allowance);
    }

    /** Make sure that applying the given allowance to the given base will result in the correct total time*/
    private void testAllowanceTime(Envelope base, EnvelopeSimContext context, AbstractAllowanceWithRanges allowance) {
        var allowanceEnvelope = allowance.apply(base, context);
        var marginTime = allowanceEnvelope.getTotalTime();
        var targetTime = allowance.getTargetTime(base);
        assertEquals(marginTime, targetTime, context.timeStep);
    }

    private void testTransitionPoints(
            Envelope base,
            EnvelopeSimContext context,
            AbstractAllowanceWithRanges allowance
    ) {

        final double tolerance = 0.02; // percentage
        var beginPos = allowance.beginPos;
        var endPos = allowance.endPos;
        var allowanceEnvelope = allowance.apply(base, context);

        var timeBeginPointBase = base.interpolateTotalTime(beginPos);
        var timeEndPointBase = base.interpolateTotalTime(endPos);

        var timeBeginPoint = allowanceEnvelope.interpolateTotalTime(beginPos);
        var timeEndPoint = allowanceEnvelope.interpolateTotalTime(endPos);
        var expectedTimeEndPoint = timeEndPointBase + allowance.getAddedTime(base);

        // make sure begin has the same time before and after margin, and that end is offset by the proper value
        assertEquals(timeBeginPointBase, timeBeginPoint, context.timeStep);
        assertEquals(expectedTimeEndPoint, timeEndPoint, context.timeStep);

        var speedBeginPointBase = base.interpolateSpeed(beginPos);
        var speedEndPointBase = base.interpolateSpeed(endPos);

        var speedBeginPoint = allowanceEnvelope.interpolateSpeed(beginPos);
        var speedEndPoint = allowanceEnvelope.interpolateSpeed(endPos);

        // make sure begin and end have the same speed before and after margin
        assertEquals(speedBeginPointBase, speedBeginPoint, speedBeginPointBase * tolerance);
        assertEquals(speedEndPointBase, speedEndPoint, speedEndPointBase * tolerance);
    }

    /** Test mareco distribution with percentage time */
    @ParameterizedTest
    @ValueSource(doubles = {0.0, 10, 100})
    public void testPercentageTimeAllowances(double value) {
        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);

        var stops = new double[] { 50_000, testContext.path.getLength() };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);

        var allowanceValue = new AllowanceValue.Percentage(value);

        // test mareco distribution
        var marecoAllowance = makeStandardMarecoAllowance(0, length, 1, allowanceValue);
        testAllowanceTime(maxEffortEnvelope, testContext, marecoAllowance);

        // test linear distribution
        var linearAllowance = makeStandardLinearAllowance(0, length, 1, allowanceValue);
        testAllowanceTime(maxEffortEnvelope, testContext, linearAllowance);
    }

    /** Test mareco with a time per distance allowance */
    @ParameterizedTest
    @ValueSource(doubles = {0.0, 4.5, 5.5})
    public void testTimePerDistanceAllowances(double value) {

        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 50_000, testContext.path.getLength() };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);

        var allowanceValue = new AllowanceValue.TimePerDistance(value);

        // test mareco distribution
        var marecoAllowance = makeStandardMarecoAllowance(0, length, 1, allowanceValue);
        testAllowanceTime(maxEffortEnvelope, testContext, marecoAllowance);

        // test linear distribution
        var linearAllowance = makeStandardLinearAllowance(0, length, 1, allowanceValue);
        testAllowanceTime(maxEffortEnvelope, testContext, linearAllowance);
    }

    private void testEngineeringAllowance(Envelope base, EnvelopeSimContext context,
                                          AbstractAllowanceWithRanges allowance) {
        testAllowanceTime(base, context, allowance);
        testTransitionPoints(base, context, allowance);
    }

    @ParameterizedTest
    @ValueSource(doubles = {0.0, 60, 200})
    public void testEngineeringAllowancesFlat(double value) {
        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 50_000, length };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var allowanceValue = new AllowanceValue.FixedTime(value);

        // test mareco distribution
        var marecoAllowance = makeStandardMarecoAllowance(0, length, 8.33, allowanceValue);
        testEngineeringAllowance(maxEffortEnvelope, testContext, marecoAllowance);

        // test linear distribution
        var linearAllowance = makeStandardLinearAllowance(0, length, 8.33, allowanceValue);
        testEngineeringAllowance(maxEffortEnvelope, testContext, linearAllowance);
    }

    @ParameterizedTest
    @ValueSource(doubles = {0.0, 60, 200})
    public void testEngineeringAllowancesSteep(double value) {
        var length = 100_000;
        var testContext = makeSimpleContext(length, 20);
        var stops = new double[] { 50000, length };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var allowanceValue = new AllowanceValue.FixedTime(value);

        // test mareco distribution
        var marecoAllowance = makeStandardMarecoAllowance(0, length, 8.33, allowanceValue);
        testEngineeringAllowance(maxEffortEnvelope, testContext, marecoAllowance);

        // test linear distribution
        var linearAllowance = makeStandardLinearAllowance(0, length, 8.33, allowanceValue);
        testEngineeringAllowance(maxEffortEnvelope, testContext, linearAllowance);
    }

    /** Test engineering allowance with fixed time on a segment */
    @ParameterizedTest
    @ValueSource(doubles = {0.0, 60, 200})
    public void testEngineeringAllowancesOnSegment(double value) {

        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 2_000, 50_000, length };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var allowanceValue = new AllowanceValue.FixedTime(value);
        double begin = 20_000;
        double end = 40_000;

        // test mareco distribution
        var marecoAllowance = makeStandardMarecoAllowance(begin, end, 8.33, allowanceValue);
        testEngineeringAllowance(maxEffortEnvelope, testContext, marecoAllowance);

        // test linear distribution
        var linearAllowance = makeStandardLinearAllowance(begin, end, 8.33, allowanceValue);
        testEngineeringAllowance(maxEffortEnvelope, testContext, linearAllowance);
    }

    /** Test the engineering allowance with a high value on a short segment, expecting to get an error */
    @Test
    public void testImpossibleEngineeringAllowances() {
        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 50_000, length };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var allowanceValue = new AllowanceValue.FixedTime(20_000);
        double begin = 20_000;
        double end = 40_000;

        // test mareco distribution
        var marecoAllowance = makeStandardMarecoAllowance(begin, end, 8.33, allowanceValue);
        var marecoThrown = assertThrows(
                OSRDError.class,
                () -> marecoAllowance.apply(maxEffortEnvelope, testContext)
            );
        assertEquals(marecoThrown.osrdErrorType, ErrorType.AllowanceConvergenceTooMuchTime);

        // test linear distribution
        var linearAllowance = makeStandardLinearAllowance(begin, end, 8.33, allowanceValue);
        var linearThrown = assertThrows(
                OSRDError.class,
                () -> linearAllowance.apply(maxEffortEnvelope, testContext)
            );
        assertEquals(linearThrown.osrdErrorType, ErrorType.AllowanceConvergenceTooMuchTime);
    }

    /** Test the engineering allowance with a very short segment, to trigger intersectLeftRightParts method */
    @Test
    public void testIntersectLeftRightParts() {
        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 50_000, length };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var allowanceValue = new AllowanceValue.FixedTime(20);
        double begin = 20_000;
        double end = 21_000;

        // test mareco distribution
        var marecoAllowance = makeStandardMarecoAllowance(begin, end, 8.33, allowanceValue);
        var marecoThrown = assertThrows(
                OSRDError.class,
                () -> marecoAllowance.apply(maxEffortEnvelope, testContext)
            );
        assertEquals(marecoThrown.osrdErrorType, ErrorType.AllowanceConvergenceTooMuchTime);

        // test linear distribution
        var linearAllowance = makeStandardLinearAllowance(begin, end, 8.33, allowanceValue);
        var linearThrown =
                assertThrows(OSRDError.class,
                        () -> linearAllowance.apply(maxEffortEnvelope, testContext));
        assertEquals(linearThrown.osrdErrorType, ErrorType.AllowanceConvergenceTooMuchTime);
    }

    private void testEngineeringOnStandardAllowance(Envelope maxEffortEnvelope,
                                                     EnvelopeSimContext context,
                                                     AbstractAllowanceWithRanges standardAllowance,
                                                     AbstractAllowanceWithRanges engineeringAllowance) {
        var standardEnvelope = standardAllowance.apply(maxEffortEnvelope, context);
        var engineeringEnvelope = engineeringAllowance.apply(standardEnvelope, context);

        var baseTime = maxEffortEnvelope.getTotalTime();
        var standardAllowanceAddedTime = standardAllowance.getAddedTime(maxEffortEnvelope);
        var engineeringAllowanceAddedTime = engineeringAllowance.getAddedTime(standardEnvelope);
        var targetTime = baseTime + standardAllowanceAddedTime + engineeringAllowanceAddedTime;
        var marginTime = engineeringEnvelope.getTotalTime();
        assertEquals(marginTime, targetTime, 2 * context.timeStep);

        var engineeringAllowanceTargetTime = engineeringAllowance.getTargetTime(standardEnvelope);
        assertEquals(marginTime, engineeringAllowanceTargetTime, context.timeStep);

    }

    @Test
    public void testEngineeringOnStandardAllowances() {
        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 50_000, length };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        double begin = 30_000;
        double end = 50_000;

        var standardAllowanceValue = new AllowanceValue.Percentage(10);
        var engineeringAllowanceValue = new AllowanceValue.FixedTime(30);

        // test mareco distribution
        var standardMarecoAllowance = makeStandardMarecoAllowance(0, length, 8.33, standardAllowanceValue);
        var engineeringMarecoAllowance = makeStandardMarecoAllowance(begin, end, 8.33, engineeringAllowanceValue);
        testEngineeringOnStandardAllowance(maxEffortEnvelope, testContext, standardMarecoAllowance,
                engineeringMarecoAllowance);

        // test linear distribution
        var standardLinearAllowance = makeStandardLinearAllowance(0, length, 8.33, standardAllowanceValue);
        var engineeringLinearAllowance = makeStandardLinearAllowance(begin, end, 8.33, engineeringAllowanceValue);
        testEngineeringOnStandardAllowance(maxEffortEnvelope, testContext, standardLinearAllowance,
                engineeringLinearAllowance);
    }

    private void testSeveralEngineeringAllowances(Envelope maxEffortEnvelope,
                                                   EnvelopeSimContext testContext,
                                                   AbstractAllowanceWithRanges allowanceA,
                                                   AbstractAllowanceWithRanges allowanceB) {
        var engineeringEnvelopeA = allowanceA.apply(maxEffortEnvelope, testContext);
        var engineeringEnvelopeB = allowanceB.apply(engineeringEnvelopeA, testContext);
        var baseTime = maxEffortEnvelope.getTotalTime();
        var targetTime = baseTime
                + allowanceA.getAddedTime(maxEffortEnvelope)
                + allowanceB.getAddedTime(maxEffortEnvelope);
        var marginTime = engineeringEnvelopeB.getTotalTime();
        assertEquals(marginTime, targetTime, 2 * testContext.timeStep);
    }

    /** Test several engineering allowances on segments */
    @ParameterizedTest
    @ValueSource(ints = {30_000, 50_000, 70_000})
    public void testSeveralEngineeringAllowances(double value) {

        var length = 100_000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { 50_000, length };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var allowanceValueA = new AllowanceValue.FixedTime(15);
        var allowanceValueB = new AllowanceValue.FixedTime(30);

        // test mareco distribution
        var marecoAllowanceA = makeStandardMarecoAllowance(0, value, 8.33, allowanceValueA);
        var marecoAllowanceB = makeStandardMarecoAllowance(value, length, 8.33, allowanceValueB);
        testSeveralEngineeringAllowances(maxEffortEnvelope, testContext, marecoAllowanceA, marecoAllowanceB);

        // test linear distribution
        var linearAllowanceA = makeStandardLinearAllowance(0, value, 8.33, allowanceValueA);
        var linearAllowanceB = makeStandardLinearAllowance(value, length, 8.33, allowanceValueB);
        testSeveralEngineeringAllowances(maxEffortEnvelope, testContext, linearAllowanceA, linearAllowanceB);
    }

    /** Test standard mareco allowance with different slopes*/
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

        var testRollingStock = SimpleRollingStock.STANDARD_TRAIN;
        var length = 100_000;
        var testPath = buildNonElectrified(length, gradePositions, gradeValues);
        var testContext = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP,
                SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP);
        var stops = new double[] { 50_000, testContext.path.getLength() };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);

        var allowanceValue = new AllowanceValue.Percentage(40);

        // test mareco distribution
        var marecoAllowance = makeStandardMarecoAllowance(0, length, 1, allowanceValue);
        testAllowanceTime(maxEffortEnvelope, testContext, marecoAllowance);

        // test linear distribution
        var linearAllowance = makeStandardLinearAllowance(0, length, 1, allowanceValue);
        testAllowanceTime(maxEffortEnvelope, testContext, linearAllowance);
    }

    /** Test standard mareco allowance with different accelerating slopes*/
    @Test
    @SuppressFBWarnings("FL_FLOATS_AS_LOOP_COUNTERS")
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

        var testRollingStock = SimpleRollingStock.STANDARD_TRAIN;
        var testPath = buildNonElectrified(length, gradePositions.toArray(), gradeValues.toArray());
        var testContext = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP,
                SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP);
        var stops = new double[]{ 50_000, length };
        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops);
        var allowanceValue = new AllowanceValue.Percentage(10);
        var allowance = makeStandardMarecoAllowance(0, testPath.getLength(), 1, allowanceValue);
        var marecoEnvelope = allowance.apply(maxEffortEnvelope, testContext);
        var targetTime = allowance.getTargetTime(maxEffortEnvelope);
        var marginTime = marecoEnvelope.getTotalTime();
        assertEquals(marginTime, targetTime, testContext.timeStep);

        // The train space-speed curve is supposed to follow this complicated shape because of the multiple
        // accelerating slopes.
        // If the test fails here, plot the curves to check if the curve makes sense and adapt the shape.
        // It is not supposed to be an absolute shape, but at least to be triggered if MARECO doesn't take into
        // account the accelerating slopes
        check(marecoEnvelope, new EnvelopeShape[][]{
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
        var allowanceValue = new AllowanceValue.Percentage(10);

        // test mareco distribution
        var marecoAllowance = makeStandardMarecoAllowance(0, length, 1, allowanceValue);
        makeSimpleAllowanceEnvelope(testContext, marecoAllowance, 100, false);

        // test linear distribution
        var linearAllowance = makeStandardLinearAllowance(0, length, 1, allowanceValue);
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
        var allowanceValue = new AllowanceValue.TimePerDistance(10);

        // test mareco distribution
        var marecoAllowance = makeStandardMarecoAllowance(0, length, 1, allowanceValue);
        marecoAllowance.apply(maxEffortEnvelope, testContext);

        // test linear distribution
        var linearAllowance = makeStandardLinearAllowance(0, length, 1, allowanceValue);
        linearAllowance.apply(maxEffortEnvelope, testContext);
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
        var allowanceValue = new AllowanceValue.TimePerDistance(10);

        // test mareco distribution
        var marecoAllowance = makeStandardMarecoAllowance(0, length, 1, allowanceValue);
        marecoAllowance.apply(maxEffortEnvelope, testContext);

        // test linear distribution
        var linearAllowance = makeStandardLinearAllowance(0, length, 1, allowanceValue);
        linearAllowance.apply(maxEffortEnvelope, testContext);
    }

    @Test
    public void testMarecoHighSlopeAtEnd() {
        var testRollingStock = SimpleRollingStock.SHORT_TRAIN;

        var length = 15000;
        var gradePositions = new double[] { 0, 7000, 8100, length };
        var gradeValues = new double[] { 0, 40, 0 };
        var testPath = buildNonElectrified(length, gradePositions, gradeValues);
        var testContext = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP,
                SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP);
        var stops = new double[] { length };
        var begin = 3000;
        var end = 8000;

        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 30, stops);
        var allowanceValue = new AllowanceValue.FixedTime(10);

        // test mareco distribution
        var marecoAllowance = makeStandardMarecoAllowance(begin, end, 1, allowanceValue);
        marecoAllowance.apply(maxEffortEnvelope, testContext);

        // test linear distribution
        var linearAllowance = makeStandardLinearAllowance(begin, end, 1, allowanceValue);
        linearAllowance.apply(maxEffortEnvelope, testContext);
    }

    @Test
    public void testAllowancesDiscontinuity() {
        var length = 10000;
        var testContext = makeSimpleContext(length, 0);
        var stops = new double[] { length };
        var begin = 2000;

        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 30, stops);
        var allowanceValue = new AllowanceValue.Percentage(90);

        // test mareco distribution
        var marecoAllowance = makeStandardMarecoAllowance(begin, length, 10, allowanceValue);
        marecoAllowance.apply(maxEffortEnvelope, testContext);

        // test linear distribution
        var linearAllowance = makeStandardLinearAllowance(begin, length, 10, allowanceValue);
        linearAllowance.apply(maxEffortEnvelope, testContext);
    }

    @Test
    public void testAllowancesErrors() {
        var length = 10_000;
        var testContext = makeSimpleContext(length, 0);
        var allowanceValue = new AllowanceValue.Percentage(1e10);

        // test mareco distribution
        var marecoAllowance = makeStandardMarecoAllowance(0, length, 1, allowanceValue);
        var marecoException = assertThrows(
                OSRDError.class, 
                () -> makeSimpleAllowanceEnvelope(testContext, marecoAllowance, 44.4, true)
            );
        assertEquals(marecoException.osrdErrorType, ErrorType.AllowanceConvergenceTooMuchTime);

        // test linear distribution
        var linearAllowance = makeStandardLinearAllowance(0, length, 1, allowanceValue);
        var linearException = assertThrows(OSRDError.class, () ->
                makeSimpleAllowanceEnvelope(testContext, linearAllowance, 44.4, true)
        );
        assertEquals(linearException.osrdErrorType, ErrorType.AllowanceConvergenceTooMuchTime);
        assert linearException.cause == ErrorCause.USER;
    }

    @Test
    public void testShortLinear() {
        var length = 1000;
        var testContext = makeSimpleContext(length, 0, 2.0);
        var stops = new double[] { length };

        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 100, stops);

        var allowance = new LinearAllowance(
                800,
                810,
                10,
                List.of(
                        new AllowanceRange(800, 810, new AllowanceValue.Percentage(10))
                )
        );
        var thrown = assertThrows(OSRDError.class, () -> allowance.apply(maxEffortEnvelope, testContext));
        assertEquals(thrown.osrdErrorType, ErrorType.AllowanceConvergenceTooMuchTime);
    }

    @Test
    public void testMarecoAfterLinear() {
        var length = 2524;
        var testContext = makeSimpleContext(length, 0, 2.0);
        var stops = new double[] { length };

        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 100, stops);

        var firstAllowance = new LinearAllowance(
                655,
                2258,
                9.1,
                List.of(
                        new AllowanceRange(655, 2258, new AllowanceValue.Percentage(8.1))
                )
        );

        var secondAllowance = new MarecoAllowance(
                485,
                2286,
                3.44,
                List.of(
                        new AllowanceRange(485, 2286, new AllowanceValue.Percentage(13))
                )
        );
        secondAllowance.apply(firstAllowance.apply(maxEffortEnvelope, testContext), testContext);
    }

    @Test
    public void testPercentageAfterTimePerDistance() {
        var length = 10_000;
        var testContext = makeSimpleContext(length, 0, 2.0);
        var stops = new double[] { 10_000 };

        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 40, stops);

        var allowance = new MarecoAllowance(
                0,
                10_000,
                1,
                List.of(
                        new AllowanceRange(0, 8_000, new AllowanceValue.TimePerDistance(1_000)),
                        new AllowanceRange(8_000, 10_000, new AllowanceValue.Percentage(10))
                )
        );
        allowance.apply(maxEffortEnvelope, testContext);
    }
}
