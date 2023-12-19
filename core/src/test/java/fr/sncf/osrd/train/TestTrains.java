package fr.sncf.osrd.train;

import static fr.sncf.osrd.envelope_sim.SimpleRollingStock.createEffortSpeedCurve;
import static fr.sncf.osrd.envelope_sim.SimpleRollingStock.CurveShape;
import static fr.sncf.osrd.train.RollingStock.Comfort;

import com.google.common.collect.Lists;
import fr.sncf.osrd.utils.Helpers;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType;
import org.junit.jupiter.api.Test;
import java.util.*;

public class TestTrains {
    public static final RollingStock REALISTIC_FAST_TRAIN;
    public static final RollingStock REALISTIC_FAST_TRAIN_MAX_DEC_TYPE;
    public static final RollingStock VERY_SHORT_FAST_TRAIN;
    public static final RollingStock VERY_LONG_FAST_TRAIN;
    public static final RollingStock FAST_TRAIN_LARGE_GAUGE;
    public static final RollingStock FAST_ELECTRIC_TRAIN;

    public static final RollingStock CONSTANT_POWER_TRAIN;

    public static final double MAX_SPEED = 300 / 3.6;

    private static Map<String, RollingStock.ModeEffortCurves> createModeEffortCurves(
            double maxSpeed,
            CurveShape curveShape,
            Map<String, RollingStock.EffortCurveConditions[]> effortCurveConditions
    ) {
        Map<String, RollingStock.ModeEffortCurves> res = new HashMap<>();
        for (var entry : effortCurveConditions.entrySet()) {
            var mode = entry.getKey();
            var modeSpeed = maxSpeed;
            switch (mode) {
                case "thermal" -> modeSpeed *= 0.92;
                case "1500V" -> modeSpeed *= 0.82;
                default -> { }
            }
            var conditions = entry.getValue();
            var isElectric = !mode.equals("thermal");
            var conditionalEffortSpeedCurves = new ArrayList<>();
            for (var condition : conditions) {
                var speed = modeSpeed;
                switch (condition.comfort()) {
                    case HEATING -> speed *= 0.91;
                    case AC -> speed *= .81;
                    default -> { }
                }
                if (condition.electricalProfile() != null)
                    switch (condition.electricalProfile()) {
                        case "22500V" -> speed *= 0.9;
                        case "20000V" -> speed *= .8;
                        default -> { }
                    }
                if (condition.powerRestriction() != null)
                    switch (condition.powerRestriction()) {
                        case "Restrict1" -> speed *= 0.89;
                        case "Restrict2" -> speed *= .79;
                        default -> { }
                    }
                var effortSpeedCurve = createEffortSpeedCurve(speed, curveShape);
                conditionalEffortSpeedCurves.add(new RollingStock.ConditionalEffortCurve(condition, effortSpeedCurve));
            }

            res.put(mode, new RollingStock.ModeEffortCurves(isElectric,
                    createEffortSpeedCurve(modeSpeed, curveShape),
                    conditionalEffortSpeedCurves.toArray(new RollingStock.ConditionalEffortCurve[0])));
        }
        return res;
    }

    static {
        double trainMass = 850000; // in kilos

        var linearModeEffortCurves = createModeEffortCurves(MAX_SPEED, CurveShape.LINEAR,
                Map.of("thermal", new RollingStock.EffortCurveConditions[0]));

        var complexModeEffortCurves = createModeEffortCurves(MAX_SPEED, CurveShape.LINEAR,
                Map.of("thermal",
                        new RollingStock.EffortCurveConditions[] {
                                new RollingStock.EffortCurveConditions(Comfort.AC, null, null),
                                new RollingStock.EffortCurveConditions(Comfort.HEATING, null, null) },
                        "1500V", new RollingStock.EffortCurveConditions[0],
                        "25000V",
                        Lists.cartesianProduct(
                            List.of(Comfort.STANDARD, Comfort.AC, Comfort.HEATING),
                            List.of("25000V", "22500V", "20000V", "null"),
                            List.of("Restrict1", "Restrict2", "null")
                        ).stream()
                        .map(triple -> new RollingStock.EffortCurveConditions(
                            (Comfort) triple.get(0), triple.get(1).equals("null") ? null : (String) triple.get(1),
                            triple.get(2).equals("null") ? null : (String) triple.get(2))
                        ).toArray(RollingStock.EffortCurveConditions[]::new)));

        VERY_SHORT_FAST_TRAIN = new RollingStock(
                "fast train",
                1, trainMass, 1.05, (0.65 * trainMass) / 100,
                ((0.008 * trainMass) / 100) * 3.6,
                (((0.00012 * trainMass) / 100) * 3.6) * 3.6,
                MAX_SPEED,
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
                MAX_SPEED,
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
                MAX_SPEED,
                30,
                0.05,
                0.25,
                0.5,
                PhysicsRollingStock.GammaType.CONST,
                RJSLoadingGaugeType.G1,
                complexModeEffortCurves,
                "thermal",
                "5",
                Map.of("Restrict1", "4", "Restrict2", "3"),
                0.,
                0.
        );

        REALISTIC_FAST_TRAIN_MAX_DEC_TYPE = new RollingStock(
                "fast train",
                400, trainMass, 1.05, (0.65 * trainMass) / 100,
                ((0.008 * trainMass) / 100) * 3.6,
                (((0.00012 * trainMass) / 100) * 3.6) * 3.6,
                MAX_SPEED,
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
                MAX_SPEED,
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
                MAX_SPEED,
                30,
                0.05,
                0.25,
                0.5,
                PhysicsRollingStock.GammaType.CONST,
                RJSLoadingGaugeType.G1,
                createModeEffortCurves(MAX_SPEED, CurveShape.LINEAR,
                        Map.of("25000V", new RollingStock.EffortCurveConditions[0])),
                "25000V",
                "1"
        );

        CONSTANT_POWER_TRAIN = new RollingStock(
                "fast train",
                400, trainMass, 1.05, (0.65 * trainMass) / 100,
                ((0.008 * trainMass) / 100) * 3.6,
                (((0.00012 * trainMass) / 100) * 3.6) * 3.6,
                MAX_SPEED,
                30,
                0.05,
                0.25,
                0.5,
                PhysicsRollingStock.GammaType.CONST,
                RJSLoadingGaugeType.G1,
                createModeEffortCurves(MAX_SPEED, CurveShape.HYPERBOLIC,
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
