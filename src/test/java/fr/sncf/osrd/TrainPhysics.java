package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.TrainPhysicsSimulator;
import fr.sncf.osrd.util.PointSequence;
import org.junit.jupiter.api.Test;


public class TrainPhysics {
    private RollingStock makeFastTrain() throws InvalidInfraException {
        double trainMass = 900000; // in kilos
        int maxSpeed = 320;
        var tractiveEffortCurve = new PointSequence<Double>();

        {
            var builder = tractiveEffortCurve.builder();
            var maxEffort = 500000;
            var minEffort = 200000;
            for (int speed = 0; speed < maxSpeed; speed += 10) {
                double coeff = (double)speed / maxSpeed;
                double effort = maxEffort + (minEffort - maxEffort) * coeff;
                builder.add(speed, effort);
            }
            builder.build();
        }

        return new RollingStock(
                0.6 * trainMass / 100,
                0.007 * trainMass / 100 * 3.6,
                0.0001 * trainMass / 100 * 3.6 * 3.6,
                400,
                320,
                30,
                0.05,
                0.25,
                trainMass,
                1.05,
                true,
                true,
                true,
                true,
                true,
                tractiveEffortCurve
        );
    }

    @Test
    public void testSteepSlope() throws InvalidInfraException {
        var rollingStock = makeFastTrain();

        double speed = 0.0;

        // how fast would a train go after 10 steps of 1 sec, coasting on a
        // 40m / km slope?
        for (int i = 0; i < 10; i++) {
            var simulator = TrainPhysicsSimulator.make(1.0, rollingStock, speed,40);
            speed = simulator.computeUpdate(0.0, 0.0).speed;
        }

        // we expect about -4m/s (the train goes backward)
        assertTrue(speed < -1 && speed > -5, String.valueOf(speed));
    }

    @Test
    public void testAccelerateAndCoast() throws InvalidInfraException {
        var rollingStock = makeFastTrain();

        double speed = 0.0;

        // make a huge traction effort
        var simulator = TrainPhysicsSimulator.make(1.0, rollingStock, speed, 0.0);
        speed = simulator.computeUpdate(500000.0, 0.0).speed;

        assertTrue(speed > 0.5);

        // the train should be able to coast for a minute without stopping
        for (int i = 0; i < 60; i++) {
            simulator = TrainPhysicsSimulator.make(1.0, rollingStock, speed, 0.0);
            double prevSpeed = speed;
            speed = simulator.computeUpdate(0.0, 0.0).speed;
            assertTrue(speed < prevSpeed && speed > 0.);
        }

        // another minute minutes later
        for (int i = 0; i < 60; i++) {
            simulator = TrainPhysicsSimulator.make(1.0, rollingStock, speed, 0.0);
            speed = simulator.computeUpdate(0.0, 0.0).speed;
        }

        // it should be stopped
        assertTrue(speed == 0.0);
    }
}
