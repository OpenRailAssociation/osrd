package fr.sncf.osrd.train;

import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType;
import java.util.*;

public class TestTrains {
    public static final RollingStock FAST_NO_FRICTION_TRAIN = new RollingStock(
            "no friction train",
            200, 1, 1, 0,
            0,
            0,
            300,
            0,
            1,
            1,
            1,
            RollingStock.GammaType.CONST,
            new RollingStock.TractiveEffortPoint[] {
                    new RollingStock.TractiveEffortPoint(0, 1)
            },
            RJSLoadingGaugeType.G1
    );

    public static final RollingStock REALISTIC_FAST_TRAIN;
    public static final RollingStock REALISTIC_FAST_TRAIN_MAX_DEC_TYPE;
    public static final RollingStock VERY_SHORT_FAST_TRAIN;
    public static final RollingStock VERY_LONG_FAST_TRAIN;
    public static final RollingStock FAST_TRAIN_LARGE_GAUGE;


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

        SortedMap<Double, Double> gammaBrakeEmergency = new TreeMap<>();
        gammaBrakeEmergency.put(0., 0.81);
        gammaBrakeEmergency.put(40., 0.72);
        gammaBrakeEmergency.put(80., 0.66);
        gammaBrakeEmergency.put(100., 0.64);
        gammaBrakeEmergency.put(155., 0.44);
        gammaBrakeEmergency.put(180., 0.48);
        gammaBrakeEmergency.put(250., 0.4);
        gammaBrakeEmergency.put(300., 0.4);

        VERY_SHORT_FAST_TRAIN = new RollingStock(
                "fast train",
                1, trainMass, 1.05, (0.65 * trainMass) / 100,
                ((0.008 * trainMass) / 100) * 3.6,
                (((0.00012 * trainMass) / 100) * 3.6) * 3.6,
                maxSpeed,
                30,
                0.05,
                0.25,
                0.5,
                RollingStock.GammaType.CONST,
                tractiveEffortCurve.toArray(new RollingStock.TractiveEffortPoint[0]),
                RJSLoadingGaugeType.G1
        );

        VERY_LONG_FAST_TRAIN = new RollingStock(
                "fast train",
                100000, trainMass, 1.05, (0.65 * trainMass) / 100,
                ((0.008 * trainMass) / 100) * 3.6,
                (((0.00012 * trainMass) / 100) * 3.6) * 3.6,
                maxSpeed,
                30,
                0.05,
                0.25,
                0.5,
                RollingStock.GammaType.CONST,
                tractiveEffortCurve.toArray(new RollingStock.TractiveEffortPoint[0]),
                RJSLoadingGaugeType.G1
        );

        REALISTIC_FAST_TRAIN = new RollingStock(
                "fast train",
                400, trainMass, 1.05, (0.65 * trainMass) / 100,
                ((0.008 * trainMass) / 100) * 3.6,
                (((0.00012 * trainMass) / 100) * 3.6) * 3.6,
                maxSpeed,
                30,
                0.05,
                0.25,
                0.5,
                RollingStock.GammaType.CONST,
                gammaBrakeEmergency,
                null,
                null,
                null,
                null,
                tractiveEffortCurve.toArray(new RollingStock.TractiveEffortPoint[0]),
                RJSLoadingGaugeType.G1
        );

        REALISTIC_FAST_TRAIN_MAX_DEC_TYPE = new RollingStock(
                "fast train",
                400, trainMass, 1.05, (0.65 * trainMass) / 100,
                ((0.008 * trainMass) / 100) * 3.6,
                (((0.00012 * trainMass) / 100) * 3.6) * 3.6,
                maxSpeed,
                30,
                0.05,
                0.25,
                0.95,
                RollingStock.GammaType.MAX,
                tractiveEffortCurve.toArray(new RollingStock.TractiveEffortPoint[0]),
                RJSLoadingGaugeType.G1
        );

        FAST_TRAIN_LARGE_GAUGE = new RollingStock(
                "fast train",
                400, trainMass, 1.05, (0.65 * trainMass) / 100,
                ((0.008 * trainMass) / 100) * 3.6,
                (((0.00012 * trainMass) / 100) * 3.6) * 3.6,
                maxSpeed,
                30,
                0.05,
                0.25,
                0.5,
                RollingStock.GammaType.CONST,
                tractiveEffortCurve.toArray(new RollingStock.TractiveEffortPoint[0]),
                RJSLoadingGaugeType.GC
        );
    }
}
