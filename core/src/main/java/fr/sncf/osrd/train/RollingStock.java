package fr.sncf.osrd.train;

import com.google.common.collect.ImmutableRangeMap;
import com.google.common.collect.RangeMap;
import com.google.common.collect.TreeRangeMap;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.envelope_sim.electrification.Electrification;
import fr.sncf.osrd.envelope_sim.electrification.Electrified;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType;
import java.util.Map;
import java.util.Set;


/**
 * The immutable characteristics of a specific train.
 * There must be a RollingStock instance per train on the network.
 */
@SuppressFBWarnings({ "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD" })
public class RollingStock implements PhysicsRollingStock {
    public final String id;

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
     * The time the train takes to start up, in seconds.
     * During this time, the train's maximum acceleration is limited.
     */
    public final double startUpTime;

    /**
     * The acceleration to apply during the startup state.
     */
    public final double startUpAcceleration;

    /**
     * The maximum acceleration when the train is in its regular operating mode.
     */
    public final double comfortAcceleration;

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

    public final RJSLoadingGaugeType loadingGaugeType;

    /**
     * Associates a speed to a force.
     * https://en.wikipedia.org/wiki/Tractive_force#Tractive_effort_curves
     */
    protected final Map<String, ModeEffortCurves> modes;

    private final String defaultMode;
    public final String basePowerClass;
    public final Map<String, String> powerRestrictions;

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

    /**
     * Gets the rolling resistance at a given speed, which is a force that always goes
     * opposite to the train's movement direction
     */
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
    public double getMaxBrakingForce(double speed) {
        return gamma * inertia;
    }

    @Override
    public GammaType getGammaType() {
        return gammaType;
    }

    public record ModeEffortCurves(boolean isElectric, TractiveEffortPoint[] defaultCurve,
                                   ConditionalEffortCurve[] curves) {
    }

    public record ConditionalEffortCurve(EffortCurveConditions cond, TractiveEffortPoint[] curve) {
    }

    public record EffortCurveConditions(Comfort comfort, String electricalProfile, String powerRestriction) {
        /**
         * Returns true if the conditions are met
         * If comfort condition is null then it matches any comfort, same for electrical profile
         */
        public boolean match(EffortCurveConditions other) {
            return (this.comfort == null || other.comfort == this.comfort)
                    && (this.electricalProfile == null || this.electricalProfile.equals(other.electricalProfile))
                    && (this.powerRestriction == null || this.powerRestriction.equals(other.powerRestriction));
        }
    }

    public record InfraConditions(String mode, String electricalProfile, String powerRestriction) {
    }

    public enum Comfort {
        STANDARD,
        HEATING,
        AC,
    }

    protected record CurveAndCondition(TractiveEffortPoint[] curve, InfraConditions cond) {
    }

    public record CurvesAndConditions(RangeMap<Double, TractiveEffortPoint[]> curves,
                                      RangeMap<Double, InfraConditions> conditions) {
    }

    /**
     * Returns Gamma
     */
    public double getDeceleration() {
        return -gamma;
    }

    /**
     * Returns the tractive effort curve that matches best, along with the catenary conditions that matched
     */
    protected CurveAndCondition findTractiveEffortCurve(Comfort comfort, Electrification electrification) {
        var usedMode = defaultMode;
        var chosenCond = new EffortCurveConditions(comfort, null, null);

        if (electrification instanceof Electrified e) {
            usedMode = modes.containsKey(e.mode) ? e.mode : defaultMode;
            chosenCond = new EffortCurveConditions(comfort, e.profile, e.powerRestriction);
        }

        var mode = modes.get(usedMode);
        // Get first matching curve
        for (var condCurve : mode.curves) {
            if (condCurve.cond.match(chosenCond)) {
                return new CurveAndCondition(condCurve.curve,
                        new InfraConditions(usedMode, condCurve.cond.electricalProfile,
                                condCurve.cond.powerRestriction));
            }
        }
        return new CurveAndCondition(mode.defaultCurve, new InfraConditions(usedMode, null, null));
    }

    /**
     * Returns the tractive effort curves corresponding to the electrical conditions map
     *
     * @param electrificationMap The map of electrification conditions to use
     * @param comfort            The comfort level to get the curves for
     */
    public CurvesAndConditions mapTractiveEffortCurves(RangeMap<Double, Electrification> electrificationMap,
                                                       Comfort comfort) {
        TreeRangeMap<Double, InfraConditions> conditionsUsed = TreeRangeMap.create();
        TreeRangeMap<Double, TractiveEffortPoint[]> res = TreeRangeMap.create();

        for (var elecCondEntry : electrificationMap.asMapOfRanges().entrySet()) {
            var curveAndCond = findTractiveEffortCurve(comfort, elecCondEntry.getValue());
            res.put(elecCondEntry.getKey(), curveAndCond.curve);
            conditionsUsed.put(elecCondEntry.getKey(), curveAndCond.cond);
        }
        return new CurvesAndConditions(ImmutableRangeMap.copyOf(res), ImmutableRangeMap.copyOf(conditionsUsed));
    }

    public Set<String> getModeNames() {
        return modes.keySet();
    }

    /**
     * Return whether this rolling stock support only electric modes
     */
    public boolean isElectricOnly() {
        for (var mode : modes.values()) {
            if (!mode.isElectric)
                return false;
        }
        return true;
    }

    /**
     * Creates a new rolling stock (a physical train inventory item).
     */
    public RollingStock(
            String id,
            double length,
            double mass,
            double inertiaCoefficient,
            double a,
            double b,
            double c,
            double maxSpeed,
            double startUpTime,
            double startUpAcceleration,
            double comfortAcceleration,
            double gamma,
            GammaType gammaType,
            RJSLoadingGaugeType loadingGaugeType,
            Map<String, ModeEffortCurves> modes,
            String defaultMode,
            String basePowerclass,
            Map<String, String> powerRestrictions
    ) {
        this.id = id;
        this.A = a;
        this.B = b;
        this.C = c;
        this.length = length;
        this.maxSpeed = maxSpeed;
        this.startUpTime = startUpTime;
        this.startUpAcceleration = startUpAcceleration;
        this.comfortAcceleration = comfortAcceleration;
        this.gamma = gamma;
        this.gammaType = gammaType;
        this.mass = mass;
        this.inertiaCoefficient = inertiaCoefficient;
        this.modes = modes;
        this.defaultMode = defaultMode;
        this.inertia = mass * inertiaCoefficient;
        this.loadingGaugeType = loadingGaugeType;
        this.basePowerClass = basePowerclass;
        this.powerRestrictions = powerRestrictions;
    }
}
