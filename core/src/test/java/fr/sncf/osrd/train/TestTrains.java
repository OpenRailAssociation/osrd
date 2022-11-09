package fr.sncf.osrd.train;

import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import java.util.ArrayList;
import java.util.Set;
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
            RJSRollingStock.GammaType.CONST,
            RJSLoadingGaugeType.G1,
            Map.of("thermal", new RollingStock.ModeEffortCurves(
                    false,
                    new RollingStock.TractiveEffortPoint[] { new RollingStock.TractiveEffortPoint(0, 1) },
                    new RollingStock.ConditionalEffortCurve[0]
                    )
            ),
            "thermal"
        );

    public static final RollingStock REALISTIC_FAST_TRAIN;
    public static final RollingStock REALISTIC_FAST_TRAIN_MAX_DEC_TYPE;
    public static final RollingStock VERY_SHORT_FAST_TRAIN;
    public static final RollingStock VERY_LONG_FAST_TRAIN;
    public static final RollingStock FAST_TRAIN_LARGE_GAUGE;
    public static final RollingStock FAST_ELECTRIC_TRAIN;


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
                RJSRollingStock.GammaType.CONST,
                RJSLoadingGaugeType.G1,
                Map.of("thermal", new RollingStock.ModeEffortCurves(
                        false,
                        tractiveEffortCurve.toArray(new RollingStock.TractiveEffortPoint[0]),
                        new RollingStock.ConditionalEffortCurve[0])
                ),
                "thermal"
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
                RJSRollingStock.GammaType.CONST,
                RJSLoadingGaugeType.G1,
                Map.of("thermal", new RollingStock.ModeEffortCurves(
                        false,
                        tractiveEffortCurve.toArray(new RollingStock.TractiveEffortPoint[0]),
                        new RollingStock.ConditionalEffortCurve[0])
                ),
                "thermal"
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
                RJSRollingStock.GammaType.CONST,
                RJSLoadingGaugeType.G1,
                Map.of("thermal", new RollingStock.ModeEffortCurves(
                        false,
                        tractiveEffortCurve.toArray(new RollingStock.TractiveEffortPoint[0]),
                        new RollingStock.ConditionalEffortCurve[0])
                ),
                "thermal"
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
                RJSRollingStock.GammaType.MAX,
                RJSLoadingGaugeType.G1,
                Map.of("thermal", new RollingStock.ModeEffortCurves(
                        false,
                        tractiveEffortCurve.toArray(new RollingStock.TractiveEffortPoint[0]),
                        new RollingStock.ConditionalEffortCurve[0])
                ),
                "thermal"
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
                RJSRollingStock.GammaType.CONST,
                RJSLoadingGaugeType.GC,
                Map.of("thermal", new RollingStock.ModeEffortCurves(
                        false,
                        tractiveEffortCurve.toArray(new RollingStock.TractiveEffortPoint[0]),
                        new RollingStock.ConditionalEffortCurve[0])
                ),
                "thermal"
        );

        FAST_ELECTRIC_TRAIN = new RollingStock(
                "fast train",
                400, trainMass, 1.05, (0.65 * trainMass) / 100,
                ((0.008 * trainMass) / 100) * 3.6,
                (((0.00012 * trainMass) / 100) * 3.6) * 3.6,
                maxSpeed,
                30,
                0.05,
                0.25,
                0.5,
                RJSRollingStock.GammaType.CONST,
                RJSLoadingGaugeType.G1,
                Map.of("25000", new RollingStock.ModeEffortCurves(
                        true,
                        tractiveEffortCurve.toArray(new RollingStock.TractiveEffortPoint[0]),
                        new RollingStock.ConditionalEffortCurve[0])
                ),
                "25000"
        );
    }
}
