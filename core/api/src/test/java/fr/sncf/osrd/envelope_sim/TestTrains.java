package fr.sncf.osrd.envelope_sim;

import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;

import java.util.ArrayList;


public class TestTrains {
    public static final PhysicsRollingStock VERY_SHORT_FAST_TRAIN;
    public static final PhysicsRollingStock REALISTIC_FAST_TRAIN;
    public static final PhysicsRollingStock REALISTIC_FAST_TRAIN_MAX_DEC_TYPE;


    static {
        double trainMass = 850000; // in kilos
        double maxSpeed = 300 / 3.6;
        var tractiveEffortCurve = new ArrayList<TestRollingStock.TractiveEffortPoint>();

        var maxEffort = 450000.0;
        var minEffort = 180000.0;
        for (int speed = 0; speed < maxSpeed; speed += 1) {
            double coeff = (double) speed / maxSpeed;
            double effort = maxEffort + (minEffort - maxEffort) * coeff;
            tractiveEffortCurve.add(new TestRollingStock.TractiveEffortPoint(speed, effort));
        }
        tractiveEffortCurve.add(new TestRollingStock.TractiveEffortPoint(maxSpeed, minEffort));

        VERY_SHORT_FAST_TRAIN = new TestRollingStock(
                1, trainMass, 1.05, (0.65 * trainMass) / 100,
                ((0.008 * trainMass) / 100) * 3.6,
                (((0.00012 * trainMass) / 100) * 3.6) * 3.6,
                maxSpeed,
                30,
                0.05,
                0.25,
                0.5,
                RJSRollingStock.RJSGammaType.CONST,
                tractiveEffortCurve.toArray(new TestRollingStock.TractiveEffortPoint[0])
        );

        REALISTIC_FAST_TRAIN = new TestRollingStock(
                400, trainMass, 1.05, (0.65 * trainMass) / 100,
                ((0.008 * trainMass) / 100) * 3.6,
                (((0.00012 * trainMass) / 100) * 3.6) * 3.6,
                maxSpeed,
                30,
                0.05,
                0.25,
                0.5,
                RJSRollingStock.RJSGammaType.CONST,
                tractiveEffortCurve.toArray(new TestRollingStock.TractiveEffortPoint[0])
        );

        REALISTIC_FAST_TRAIN_MAX_DEC_TYPE = new TestRollingStock(
                400, trainMass, 1.05, (0.65 * trainMass) / 100,
                ((0.008 * trainMass) / 100) * 3.6,
                (((0.00012 * trainMass) / 100) * 3.6) * 3.6,
                maxSpeed,
                30,
                0.05,
                0.25,
                0.95,
                RJSRollingStock.RJSGammaType.MAX,
                tractiveEffortCurve.toArray(new TestRollingStock.TractiveEffortPoint[0])
        );
    }
}
