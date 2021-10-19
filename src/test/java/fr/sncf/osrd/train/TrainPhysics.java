package fr.sncf.osrd.train;

import static fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;


public class TrainPhysics {
    @Test
    public void testSlopeNoTraction() {
        double speed = 0.0;

        // how fast would a train go after 10 steps of 1 sec, coasting on a
        // 40m / km slope?
        for (int i = 0; i < 10; i++) {
            var simulator = new TrainPhysicsIntegrator(1.0, REALISTIC_FAST_TRAIN, speed, 40);
            var step = simulator.stepFromAction(
                    Action.coast(),
                    1000.,
                    1
            );
            speed = step.finalSpeed;
        }

        // we expect about -4m/s (the train goes backward)
        assertTrue(speed < -1 && speed > -5, String.valueOf(speed));
    }

    @Test
    public void testSteepSlopeTraction() {
        var rollingStock = REALISTIC_FAST_TRAIN;

        double speed = 0.0;

        double maxTraction = rollingStock.tractiveEffortCurve[0].maxEffort;
        // how fast would a train go after 10 steps of 1 sec, full throttle on a 45deg slope?
        for (int i = 0; i < 10; i++) {
            var simulator = new TrainPhysicsIntegrator(1.0, rollingStock, speed, 1000);
            var step = simulator.stepFromAction(
                    Action.accelerate(maxTraction),
                    1000.,
                    1);
            speed = step.finalSpeed;
        }

        // we expect the train to go pretty fast
        assertTrue(speed < -10 && speed > -100, String.valueOf(speed));
    }

    @Test
    public void testSlopeChangeVMax() {
        var rollingStock = REALISTIC_FAST_TRAIN;

        double speed = 0.0;

        // go to full speed by cruising for 20 minutes
        for (int i = 0; i < 20 * 60; i++) {
            double maxTraction = rollingStock.getMaxEffort(speed);
            var simulator = new TrainPhysicsIntegrator(1.0, rollingStock, speed, 0.0);
            var step = simulator.stepFromAction(
                    Action.accelerate(maxTraction),
                    1000.,
                    1);
            speed = step.finalSpeed;
        }

        var fullThrottle = speed;
        // we expect the train to go pretty fast
        assertTrue(speed > 100, String.valueOf(speed));

        // continue the simulation, but with some slope
        for (int i = 0; i < 20 * 60; i++) {
            double maxTraction = rollingStock.getMaxEffort(speed);
            var simulator = new TrainPhysicsIntegrator(1.0, rollingStock, speed, 35.0);
            var step = simulator.stepFromAction(
                    Action.accelerate(maxTraction),
                    1000.,
                    1);
            speed = step.finalSpeed;
        }

        // we expect the train to run at less than half the speed, but still decently fast
        assertTrue(speed < fullThrottle / 2, String.valueOf(speed));
        assertTrue(speed > fullThrottle / 3, String.valueOf(speed));
    }

    @Test
    public void testAccelerateAndCoast() {
        var rollingStock = REALISTIC_FAST_TRAIN;

        double speed = 0.0;

        // make a huge traction effort
        var simulator = new TrainPhysicsIntegrator(1.0, rollingStock, speed, 0.0);
        var step = simulator.stepFromAction(
                Action.accelerate(500000.0),
                1000.,
                1);
        speed = step.finalSpeed;

        assertTrue(speed > 0.5);

        // the train should be able to coast for a minute without stopping
        for (int i = 0; i < 60; i++) {
            simulator = new TrainPhysicsIntegrator(1.0, rollingStock, speed, 0.0);
            double prevSpeed = speed;
            step = simulator.stepFromAction(Action.coast(), 1000., 1);
            speed = step.finalSpeed;
            assertTrue(speed < prevSpeed && speed > 0.);
        }

        // another minute later
        for (int i = 0; i < 60; i++) {
            simulator = new TrainPhysicsIntegrator(1.0, rollingStock, speed, 0.0);
            step = simulator.stepFromAction(Action.coast(), 1000., 1);
            speed = step.finalSpeed;
        }

        // it should be stopped
        assertEquals(speed, 0.0);
    }
}
