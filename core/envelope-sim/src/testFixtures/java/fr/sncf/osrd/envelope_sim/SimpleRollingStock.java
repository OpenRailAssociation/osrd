package fr.sncf.osrd.envelope_sim;

import com.google.common.collect.ImmutableRangeMap;
import com.google.common.collect.Range;
import fr.sncf.osrd.envelope_sim.power.EnergySource;
import fr.sncf.osrd.envelope_utils.Point2d;

import java.util.ArrayList;
import java.util.List;

import static fr.sncf.osrd.envelope_utils.CurveUtils.interpolate;
import static fr.sncf.osrd.envelope_sim.power.PowerPack.newPowerPackDiesel;

public class SimpleRollingStock implements PhysicsRollingStock {

    public final double A; // in newtons
    public final double B; // in newtons / (m/s)
    public final double C; // in newtons / (m/s^2)

    /**
     * the kind of deceleration input of the train. It can be:
     * a constant value
     * the maximum possible deceleration value
     */
    public final GammaType gammaType;

    /**
     * the deceleration of the train, in m/s^2
     */
    public final double gamma;

    /**
     * the length of the train, in meters.
     */
    public final double length;

    /**
     * The max speed of the train, in meters per seconds.
     */
    public final double maxSpeed;

    /**
     * The mass of the train, in kilograms.
     */
    public final double mass;

    /**
     * Defined as mass * inertiaCoefficient
     */
    public final double inertia;

    /**
     * Inertia coefficient.
     * The mass alone isn't sufficient to compute accelerations, as the wheels and internals
     * also need force to get spinning. This coefficient can be used to account for the difference.
     * It's without unit.
     */
    public final double inertiaCoefficient;

    private static double MAX_SPEED = 300 / 3.6;

    private final ArrayList<EnergySource> energySources;

    public SimpleRollingStock(
            double length,
            double mass,
            double inertiaCoefficient,
            double a,
            double b,
            double c,
            double maxSpeed,
            double gamma,
            GammaType gammaType,
            ArrayList<EnergySource> energySources
    ) {
        this.length = length;
        this.mass = mass;
        this.inertiaCoefficient = inertiaCoefficient;
        this.inertia = mass * inertiaCoefficient;
        this.A = a;
        this.B = b;
        this.C = c;
        this.maxSpeed = maxSpeed;
        this.gamma = gamma;
        this.gammaType = gammaType;
        this.energySources = energySources;
    }

    @Override
    public double getMass() {
        return mass;
    }

    @Override
    public double getInertia() {
        return inertia;
    }

    @Override
    public double getLength() {
        return length;
    }

    @Override
    public double getMaxSpeed() {
        return maxSpeed;
    }

    @Override
    public GammaType getGammaType() {
        return gammaType;
    }

    @Override
    public double getRollingResistance(double speed) {
        speed = Math.abs(speed);
        // this formula is called the Davis equation.
        // it's completely empirical, and models the drag and friction forces
        return A + B * speed + C * speed * speed;
    }

    @Override
    public double getRollingResistanceDeriv(double speed) {
        speed = Math.abs(speed);
        return B + 2 * C * speed;
    }

    @Override
    public double getMaxTractionForce(double speed, Point2d[] tractiveEffortCurve, boolean electrification) {
        return interpolate(speed, tractiveEffortCurve);
    }

    @Override
    public double getDeceleration() {
        return -gamma;
    }

    @Override
    public double getMaxBrakingForce(double speed) {
        return gamma * inertia;
    }

    @Override
    public void updateEnergyStorages(double tractionForce, double speed, double timeStep, boolean electrification) {
    }


    /**
     * The tractive effort curve shape. It can be either linear (effort proportional to speed), or hyperbolic (effort
     * inversely proportional to speed -> constant power)
     */
    public enum CurveShape {
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

    public static Point2d[] createEffortSpeedCurve(double maxSpeed, CurveShape curveShape) {
        var newEffortCurve = new ArrayList<Point2d>();

        for (int speed = 0; speed < maxSpeed; speed += 1) {
            double effort = getEffort(curveShape, speed, maxSpeed);
            newEffortCurve.add(new Point2d(speed, effort));
        }
        return newEffortCurve.toArray(new Point2d[0]);
    }

    public static ImmutableRangeMap<Double, Point2d[]> createEffortCurveMap(double maxSpeed,
                                                                                       CurveShape curveShape) {
        var builder = ImmutableRangeMap.<Double, Point2d[]>builder();
        builder.put(Range.all(), createEffortSpeedCurve(maxSpeed, curveShape));
        return builder.build();
    }

    /**
     * ========================================================
     * Constant rolling stocks and curves
     * ===========================================================
     */

    public static SimpleRollingStock build(
            double length,
            double gamma,
            GammaType gammaType
    ) {
        double trainMass = 850000; // in kilos
        return new SimpleRollingStock(
                length,
                trainMass, 1.05,
                (0.65 * trainMass) / 100,
                ((0.008 * trainMass) / 100) * 3.6,
                (((0.00012 * trainMass) / 100) * 3.6) * 3.6,
                MAX_SPEED,
                gamma,
                gammaType,
                new ArrayList<>(List.of(newPowerPackDiesel()))
        );
    }

    static final public ImmutableRangeMap<Double, Point2d[]> LINEAR_EFFORT_CURVE_MAP =
            createEffortCurveMap(MAX_SPEED, CurveShape.LINEAR);

    static final public ImmutableRangeMap<Double, Point2d[]> HYPERBOLIC_EFFORT_CURVE_MAP =
            createEffortCurveMap(MAX_SPEED, CurveShape.HYPERBOLIC);

    static final public SimpleRollingStock SHORT_TRAIN = SimpleRollingStock.build(1, .5, GammaType.CONST);

    static final public SimpleRollingStock STANDARD_TRAIN = SimpleRollingStock.build(400, .5, GammaType.CONST);

    static final public SimpleRollingStock MAX_DEC_TRAIN = SimpleRollingStock.build(400, .95, GammaType.MAX);
}
