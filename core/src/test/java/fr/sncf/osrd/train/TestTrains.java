package fr.sncf.osrd.train;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.Map;

public class TestTrains {
    public static final RollingStock REALISTIC_FAST_TRAIN;
    public static final RollingStock REALISTIC_FAST_TRAIN_MAX_DEC_TYPE;
    public static final RollingStock VERY_SHORT_FAST_TRAIN;
    public static final RollingStock VERY_LONG_FAST_TRAIN;
    public static final RollingStock FAST_TRAIN_LARGE_GAUGE;
    public static final RollingStock FAST_ELECTRIC_TRAIN;

    public static final RollingStock CONSTANT_POWER_TRAIN;

    /**
     * The tractive effort curve shape. It can be either linear (effort proportional to speed), or hyperbolic (effort
     * inversely proportional to speed -> constant power)
     */
    private enum CurveShape {
        LINEAR,
        HYPERBOLIC
    }

    private static ArrayList<RollingStock.TractiveEffortPoint> linearEffortCurve;
    private static ArrayList<RollingStock.TractiveEffortPoint> constantPowerEffortCurve;

    private static double getEffort(CurveShape curveShape, double speed, double maxSpeed) {
        if (curveShape == CurveShape.LINEAR) {
            var maxEffort = 450000.0;
            var minEffort = 180000.0;
            double coeff = speed / maxSpeed;
            return maxEffort + (minEffort - maxEffort) * coeff;
        }
        var maxEffort = 3_600_000.0;
        return maxEffort / Math.max(1, speed);
    }

    private static ArrayList<RollingStock.TractiveEffortPoint> createEffortSpeedCurve(
            double maxSpeed,
            CurveShape curveShape
    ) {
        var newEffortCurve = new ArrayList<RollingStock.TractiveEffortPoint>();

        for (int speed = 0; speed < maxSpeed; speed += 1) {
            double effort = getEffort(curveShape, speed, maxSpeed);
            newEffortCurve.add(new RollingStock.TractiveEffortPoint(speed, effort));
        }
        return newEffortCurve;
    }

    static {
        double trainMass = 850000; // in kilos
        double maxSpeed = 300 / 3.6;
        linearEffortCurve = createEffortSpeedCurve(maxSpeed, CurveShape.LINEAR);
        constantPowerEffortCurve = createEffortSpeedCurve(maxSpeed, CurveShape.HYPERBOLIC);

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
                        linearEffortCurve.toArray(new RollingStock.TractiveEffortPoint[0]),
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
                        linearEffortCurve.toArray(new RollingStock.TractiveEffortPoint[0]),
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
                        linearEffortCurve.toArray(new RollingStock.TractiveEffortPoint[0]),
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
                        linearEffortCurve.toArray(new RollingStock.TractiveEffortPoint[0]),
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
                        linearEffortCurve.toArray(new RollingStock.TractiveEffortPoint[0]),
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
                        linearEffortCurve.toArray(new RollingStock.TractiveEffortPoint[0]),
                        new RollingStock.ConditionalEffortCurve[0])
                ),
                "25000"
        );

        CONSTANT_POWER_TRAIN = new RollingStock(
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
                        constantPowerEffortCurve.toArray(new RollingStock.TractiveEffortPoint[0]),
                        new RollingStock.ConditionalEffortCurve[0])
                ),
                "thermal"
        );
    }

    @Test
    public void testRollingStockParsing() throws Exception {
        Helpers.getExampleRollingStocks();
    }
}
