package fr.sncf.osrd.envelope_physics;

import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.getWeightForce;
import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.newtonStep;
import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.envelope_sim.Action;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.FlatPath;
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.TestTrains;
import org.junit.jupiter.api.Test;


public class TrainPhysics {

    private static final RollingStock TEST_ROLLING_STOCK = TestTrains.REALISTIC_FAST_TRAIN;
    private static final double TIME_STEP = 1.0;

    @Test
    public void testSlopeNoTraction() {
        var testPath = new FlatPath(100000, -40);
        var context = new EnvelopeSimContext(TEST_ROLLING_STOCK, testPath, TIME_STEP);
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
        var testPath = new FlatPath(100000, -45);
        var context = new EnvelopeSimContext(TEST_ROLLING_STOCK, testPath, TIME_STEP);
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
        var testPath = new FlatPath(100000, 0);
        var context = new EnvelopeSimContext(TEST_ROLLING_STOCK, testPath, TIME_STEP);
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
        var newTestPath = new FlatPath(100000, 35);
        var newContext = new EnvelopeSimContext(TEST_ROLLING_STOCK, newTestPath, TIME_STEP);
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
        var context = new EnvelopeSimContext(TEST_ROLLING_STOCK, testPath, TIME_STEP);
        double position = 0.0;
        double speed = 0.0;

        // make a huge traction effort
        double rollingResistance = TEST_ROLLING_STOCK.getRollingResistance(speed);
        double weightForce = getWeightForce(TEST_ROLLING_STOCK, testPath, position);
        var acceleration = TrainPhysicsIntegrator.computeAcceleration(TEST_ROLLING_STOCK,
                rollingResistance, weightForce, speed, 500000.0, 0, +1);
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
            var prevSpeed = step.startSpeed;
            speed = step.endSpeed;
        }
        // it should be stopped
        assertEquals(speed, 0.0);
    }
}
