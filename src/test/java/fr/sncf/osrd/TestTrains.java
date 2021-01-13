package fr.sncf.osrd;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.train.RollingStock;

import java.util.ArrayList;

public class TestTrains {
    public static final RollingStock REALISTIC_FAST_TRAIN;
    public static final RollingStock FAST_NO_FRICTION_TRAIN;

    static {
        double trainMass = 850000; // in kilos
        double maxSpeed = 300 / 3.6;
        var tractiveEffortCurve = new ArrayList<RollingStock.TractiveEffortPoint>();

        var maxEffort = 450000.0;
        var minEffort = 180000.0;
        for (int speed = 0; speed < maxSpeed; speed += 1) {
            double coeff = (double) speed / maxSpeed;
            double effort = maxEffort + (minEffort - maxEffort) * coeff;
            tractiveEffortCurve.add(new RollingStock.TractiveEffortPoint(speed, effort));
        }
        tractiveEffortCurve.add(new RollingStock.TractiveEffortPoint(maxSpeed, minEffort));

        try {
            REALISTIC_FAST_TRAIN = new RollingStock(
                    (0.65 * trainMass) / 100,
                    ((0.008 * trainMass) / 100) * 3.6,
                    (((0.00012 * trainMass) / 100) * 3.6) * 3.6,
                    400,
                    maxSpeed,
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
                    tractiveEffortCurve.toArray(new RollingStock.TractiveEffortPoint[0])
            );

            FAST_NO_FRICTION_TRAIN = new RollingStock(
                    0,
                    0,
                    0,
                    200,
                    300,
                    0,
                    1,
                    1,
                    1,
                    1,
                    true,
                    true,
                    true,
                    true,
                    true,
                    new RollingStock.TractiveEffortPoint[] {
                        new RollingStock.TractiveEffortPoint(0, 1)
                    }
            );
        } catch (InvalidInfraException e) {
            throw new RuntimeException("error while building test trains", e);
        }
    }
}
