package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope_sim.SimpleContextBuilder.makeSimpleContext;
import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.getWeightForce;
import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.newtonStep;
import static fr.sncf.osrd.envelope_sim.allowances.mareco_impl.CoastingGenerator.coastFromBeginning;
import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType;
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration;
import org.junit.jupiter.api.Test;

public class TrainPhysicsIntegratorTest {
    private static final double TIME_STEP = 1.0;

    @Test
    public void testSlopeNoTraction() {
        var context = makeSimpleContext(100000, -40, TIME_STEP);
        double position = 0.0;
        double speed = 0.0;

        // how fast would a train go after 30 sec, coasting on a
        // -40m / km slope?
        for (int i = 0; i < 30; i++) {
            var step = TrainPhysicsIntegrator.step(context, position, speed, Action.COAST, +1);
            position += step.positionDelta;
            speed = step.endSpeed;
        }

        // we expect about +11m/s (the train goes forward)
        assertTrue(speed < 11 && speed > 10, String.valueOf(speed));
    }

    @Test
    public void testSteepSlopeTraction() {
        var context = makeSimpleContext(100000, -45, TIME_STEP);
        double position = 0.0;
        double speed = 0.0;

        // how fast would a train go after 10 steps of 1 sec, full throttle on a 45deg slope?
        for (int i = 0; i < 10; i++) {
            var step = TrainPhysicsIntegrator.step(context, position, speed, Action.ACCELERATE, +1);
            position += step.positionDelta;
            speed = step.endSpeed;
        }
        // we expect the train to go pretty fast
        assertTrue(speed > 6 && speed < 10, String.valueOf(speed));
    }

    @Test
    public void testSlopeChangeVMax() {
        var context = makeSimpleContext(100000, 0, TIME_STEP);
        double position = 0.0;
        double speed = 0.0;

        // go to full speed by cruising for 20 minutes
        for (int i = 0; i < 20 * 60; i++) {
            var step = TrainPhysicsIntegrator.step(context, position, speed, Action.ACCELERATE, +1);
            position += step.positionDelta;
            speed = step.endSpeed;
        }
        var fullThrottle = speed;
        // we expect the train to go pretty fast
        assertTrue(speed > 100, String.valueOf(speed));

        // continue the simulation, but with some slope
        var newContext = makeSimpleContext(100000, 35, TIME_STEP);
        for (int i = 0; i < 20 * 60; i++) {
            var step = TrainPhysicsIntegrator.step(newContext, position, speed, Action.ACCELERATE, +1);
            position += step.positionDelta;
            speed = step.endSpeed;
        }
        // we expect the train to run at less than half the speed, but still decently fast
        assertTrue(speed < fullThrottle / 2, String.valueOf(speed));
        assertTrue(speed > fullThrottle / 3, String.valueOf(speed));
    }

    @Test
    public void testAccelerateAndCoast() {
        var testPath = new FlatPath(100000, 0);
        var testRollingStock = SimpleRollingStock.STANDARD_TRAIN;
        var effortCurveMap = SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP;
        var context = new EnvelopeSimContext(testRollingStock, testPath, TIME_STEP, effortCurveMap);
        double position = 0.0;
        double speed = 0.0;

        // make a huge traction effort
        double rollingResistance = testRollingStock.getRollingResistance(speed);
        double weightForce = getWeightForce(testRollingStock, testPath, position);
        var acceleration = TrainPhysicsIntegrator.computeAcceleration(
                testRollingStock, rollingResistance, weightForce, speed, 500000.0, 0, +1);
        var step = newtonStep(TIME_STEP, speed, acceleration, +1);
        position += step.positionDelta;
        speed = step.endSpeed;
        assertTrue(speed > 0.5);

        // the train should be able to coast for a minute without stopping
        for (int i = 0; i < 60; i++) {
            step = TrainPhysicsIntegrator.step(context, position, speed, Action.COAST, +1);
            position += step.positionDelta;
            var prevSpeed = step.startSpeed;
            speed = step.endSpeed;
            assertTrue(speed < prevSpeed && speed > 0.);
        }

        // another minute later
        for (int i = 0; i < 60; i++) {
            step = TrainPhysicsIntegrator.step(context, position, speed, Action.COAST, +1);
            position += step.positionDelta;
            speed = step.endSpeed;
        }
        // it should be stopped
        assertEquals(speed, 0.0);
    }

    @Test
    public void testEmptyCoastFromBeginning() {
        var context = makeSimpleContext(100000, 0, TIME_STEP);
        var builder = new EnvelopePartBuilder();
        var constrainedBuilder =
                new ConstrainedEnvelopePartBuilder(builder, new SpeedConstraint(0, EnvelopePartConstraintType.FLOOR));
        EnvelopeDeceleration.decelerate(context, 0, 10, constrainedBuilder, 1);
        builder.setAttr(EnvelopeProfile.BRAKING);
        var acceleration = Envelope.make(builder.build());
        // starting a coasting phase in a braking phase must result in a null EnvelopePart
        var speed = acceleration.interpolateSpeed(0);
        var failedCoast = coastFromBeginning(acceleration, context, 0, speed);
        assertNull(failedCoast);
    }
}
