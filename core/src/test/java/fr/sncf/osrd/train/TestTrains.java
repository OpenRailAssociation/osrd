package fr.sncf.osrd.train;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.HashMap;
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

    private static Map<String, RollingStock.ModeEffortCurves> createModeEffortCurves(
            double maxSpeed,
            CurveShape curveShape,
            Map<String, RollingStock.EffortCurveConditions[]> effortCurveConditions
    ) {
        Map<String, RollingStock.ModeEffortCurves> res = new HashMap<>();
        for (var entry : effortCurveConditions.entrySet()) {
            var mode = entry.getKey();
            var conditions = entry.getValue();
            var isElectric = !mode.equals("thermal");
            var conditionalEffortSpeedCurves = new ArrayList<>();
            for (var condition : conditions) {
                var speed = maxSpeed;
                switch (condition.comfort()) {
                    case HEATING -> speed *= 0.9;
                    case AC -> speed *= .8;
                    default -> {
                    }
                }
                var effortSpeedCurve = createEffortSpeedCurve(speed, curveShape);
                conditionalEffortSpeedCurves.add(new RollingStock.ConditionalEffortCurve(
                        condition,
                        effortSpeedCurve.toArray(new RollingStock.TractiveEffortPoint[0])
                ));
            }

            res.put(mode, new RollingStock.ModeEffortCurves(isElectric,
                    createEffortSpeedCurve(maxSpeed, curveShape).toArray(
                            new PhysicsRollingStock.TractiveEffortPoint[0]),
                    conditionalEffortSpeedCurves.toArray(new RollingStock.ConditionalEffortCurve[0])));
        }
        return res;
    }

    static {
        double trainMass = 850000; // in kilos
        double maxSpeed = 300 / 3.6;

        var linearModeEffortCurves = createModeEffortCurves(maxSpeed, CurveShape.LINEAR,
                Map.of("thermal", new RollingStock.EffortCurveConditions[0]));

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
                PhysicsRollingStock.GammaType.CONST,
                RJSLoadingGaugeType.G1,
                linearModeEffortCurves,
                "thermal",
                "1"
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
                PhysicsRollingStock.GammaType.CONST,
                RJSLoadingGaugeType.G1,
                linearModeEffortCurves,
                "thermal",
                "1"
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
                PhysicsRollingStock.GammaType.CONST,
                RJSLoadingGaugeType.G1,
                createModeEffortCurves(maxSpeed, CurveShape.LINEAR,
                        Map.of("thermal", new RollingStock.EffortCurveConditions[]{
                                new RollingStock.EffortCurveConditions(RollingStock.Comfort.AC, null),
                                new RollingStock.EffortCurveConditions(RollingStock.Comfort.HEATING, null)
                        }, "25000", new RollingStock.EffortCurveConditions[]{
                                new RollingStock.EffortCurveConditions(RollingStock.Comfort.AC, "25000"),
                                new RollingStock.EffortCurveConditions(RollingStock.Comfort.HEATING, "25000"),
                                new RollingStock.EffortCurveConditions(RollingStock.Comfort.STANDARD, "25000"),
                                new RollingStock.EffortCurveConditions(RollingStock.Comfort.AC, "22500"),
                                new RollingStock.EffortCurveConditions(RollingStock.Comfort.HEATING, "22500"),
                                new RollingStock.EffortCurveConditions(RollingStock.Comfort.STANDARD, "22500")
                        }, "1500", new RollingStock.EffortCurveConditions[]{
                                new RollingStock.EffortCurveConditions(RollingStock.Comfort.AC, "O"),
                                new RollingStock.EffortCurveConditions(RollingStock.Comfort.HEATING, "O")
                        })),
                "thermal",
                "1"
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
                PhysicsRollingStock.GammaType.MAX,
                RJSLoadingGaugeType.G1,
                linearModeEffortCurves,
                "thermal",
                "1"
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
                PhysicsRollingStock.GammaType.CONST,
                RJSLoadingGaugeType.GC,
                linearModeEffortCurves,
                "thermal",
                "1"
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
                PhysicsRollingStock.GammaType.CONST,
                RJSLoadingGaugeType.G1,
                createModeEffortCurves(maxSpeed, CurveShape.LINEAR,
                        Map.of("25000", new RollingStock.EffortCurveConditions[0])),
                "25000",
                "1"
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
                PhysicsRollingStock.GammaType.CONST,
                RJSLoadingGaugeType.G1,
                createModeEffortCurves(maxSpeed, CurveShape.HYPERBOLIC,
                        Map.of("thermal", new RollingStock.EffortCurveConditions[0])),
                "thermal",
                "1"
        );
    }

    @Test
    public void testRollingStockParsing() throws Exception {
        Helpers.getExampleRollingStocks();
    }
}
