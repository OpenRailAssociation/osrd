package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope.EnvelopeShape.*;
import static fr.sncf.osrd.envelope.EnvelopeShape.DECREASING;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeTest.makeComplexMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeTest.makeSimpleMaxEffortEnvelope;
import static fr.sncf.osrd.envelope_sim.MaxSpeedEnvelopeTest.TIME_STEP;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeShape;
import fr.sncf.osrd.envelope.EnvelopeTransitions;
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

public class ConstructionEnvelopeTest {

    private Envelope makeSimpleConstructionEnvelope(PhysicsRollingStock rollingStock, PhysicsPath path, double speed,
                                                    double begin, double end, AllowanceValue value) {
        double capacitySpeedLimit = 30 / 3.6;

        var maxEffortEnvelope = makeSimpleMaxEffortEnvelope(rollingStock, path, speed);
        var allowance = new MarecoAllowance(rollingStock, path, TIME_STEP,
                begin, end, capacitySpeedLimit, value);
        return allowance.apply(maxEffortEnvelope);
    }

    @Test
    public void testFlat() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(10000, 0);
        var constructionEnvelope = makeSimpleConstructionEnvelope(
                testRollingStock, testPath, 44.4, 1000, 5000, new AllowanceValue.FixedTime(60));
        EnvelopeShape.check(constructionEnvelope,
                INCREASING, DECREASING, CONSTANT, INCREASING, DECREASING, INCREASING, DECREASING);
        var delta = 2 * constructionEnvelope.getMaxSpeed() * TIME_STEP;
        EnvelopeTransitions.checkPositions(constructionEnvelope, delta,
                1000, 1285, 4210, 5000, 6000, 8400, 9294);
        assertTrue(constructionEnvelope.continuous);
    }

    @Test
    public void testSteep() {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(10000, 20);
        var constructionEnvelope = makeSimpleConstructionEnvelope(
                testRollingStock, testPath, 44.4, 1500, 5500, new AllowanceValue.FixedTime(60));
        EnvelopeShape.check(constructionEnvelope,
                INCREASING, DECREASING, CONSTANT, INCREASING, DECREASING, INCREASING, DECREASING);
        var delta = 2 * constructionEnvelope.getMaxSpeed() * TIME_STEP;
        EnvelopeTransitions.checkPositions(constructionEnvelope, delta,
                1500, 1743, 5198, 5500, 6000, 8924);
        assertTrue(constructionEnvelope.continuous);
    }

    /** Test mareco with percentage time allowance */
    @ParameterizedTest
    @ValueSource(doubles = {0.0, 60, 200})
    public void testConstructionAllowanceOnSegment(double value) {
        var testRollingStock = TestTrains.REALISTIC_FAST_TRAIN;
        var testPath = new FlatPath(100000, 0);
        double capacitySpeedLimit = 30 / 3.6;
        double begin = 20000;
        double end = 40000;
        final double tolerance = 0.02; // percentage

        var maxEffortEnvelope = makeComplexMaxEffortEnvelope(testRollingStock, testPath);
        var allowanceValue = new AllowanceValue.FixedTime(value);
        var allowance = new MarecoAllowance(testRollingStock, testPath, TIME_STEP,
                begin, end, capacitySpeedLimit, allowanceValue);
        var constructionEnvelope = allowance.apply(maxEffortEnvelope);
        var baseTime = maxEffortEnvelope.getTotalTime();
        var distance = end - begin;
        var targetTime = baseTime + allowanceValue.getAllowanceTime(baseTime, distance);
        var marginTime = constructionEnvelope.getTotalTime();
        assertEquals(marginTime, targetTime, 2 * TIME_STEP);

        var timeFirstPointBase = maxEffortEnvelope.interpolateTotalTime(begin);
        var timeSecondPointBase = maxEffortEnvelope.interpolateTotalTime(end);

        var timeFirstPoint = constructionEnvelope.interpolateTotalTime(begin);
        var timeSecondPoint = constructionEnvelope.interpolateTotalTime(end);
        var expectedTimeSecondPoint = timeSecondPointBase + allowanceValue.getAllowanceTime(baseTime, distance);

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
}
