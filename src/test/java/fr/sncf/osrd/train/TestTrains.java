package fr.sncf.osrd.train;

import fr.sncf.osrd.RollingStock;

import java.util.ArrayList;

public class TestTrains {
    public static final RollingStock FAST_NO_FRICTION_TRAIN = new RollingStock(
            "no friction train",
            200, 1, 1, 0,
            0,
            0,
            new TrainCapability[] {
                    TrainCapability.TVM430,
                    TrainCapability.TVM300,
                    TrainCapability.ETCS1,
                    TrainCapability.ETCS2
            }, 300,
            0,
            1,
            1,
            1,
            new RollingStock.TractiveEffortPoint[] {
                    new RollingStock.TractiveEffortPoint(0, 1)
            }
    );

    public static final RollingStock REALISTIC_FAST_TRAIN;


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

        REALISTIC_FAST_TRAIN = new RollingStock(
                "fast train",
                400, trainMass, 1.05, (0.65 * trainMass) / 100,
                ((0.008 * trainMass) / 100) * 3.6,
                (((0.00012 * trainMass) / 100) * 3.6) * 3.6,
                new TrainCapability[] {
                        TrainCapability.TVM430,
                        TrainCapability.TVM300,
                        TrainCapability.ETCS1,
                        TrainCapability.ETCS2
                }, maxSpeed,
                30,
                0.05,
                0.25,
                0.5,
                tractiveEffortCurve.toArray(new RollingStock.TractiveEffortPoint[0])
        );
    }
}
