package fr.sncf.osrd.train;

import com.google.common.collect.ImmutableRangeMap;
import com.google.common.collect.Range;
import com.google.common.collect.RangeMap;
import com.google.common.collect.TreeRangeMap;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.envelope_sim.electrification.Electrification;
import fr.sncf.osrd.envelope_sim.electrification.Electrified;
import fr.sncf.osrd.envelope_sim.electrification.Neutral;
import fr.sncf.osrd.envelope_sim.electrification.NonElectrified;
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType;
import java.util.Map;
import java.util.Set;

/**
 * The immutable characteristics of a specific train. There must be a RollingStock instance per
 * train on the network.
 */
@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public final class RollingStock implements PhysicsRollingStock {
    private static final TractiveEffortPoint[] COASTING_CURVE = {
        new TractiveEffortPoint(0, 0), new TractiveEffortPoint(1, 0)
    };

    public final String id;

    public final double A; // in newtons
    public final double B; // in newtons / (m/s)
    public final double C; // in newtons / (m/s^2)

    /**
     * the kind of deceleration input of the train. It can be: a constant value the maximum possible
     * deceleration value
     */
    public final GammaType gammaType;

    /** the deceleration of the train, in m/s^2 */
    public final double gamma;

    /** the length of the train, in meters. */
    public final double length;

    /** The max speed of the train, in meters per seconds. */
    public final double maxSpeed;

    /**
     * The time the train takes to start up, in seconds. During this time, the train's maximum
     * acceleration is limited.
     */
    public final double startUpTime;

    /** The acceleration to apply during the startup state. */
    public final double startUpAcceleration;

    /** The maximum acceleration when the train is in its regular operating mode. */
    public final double comfortAcceleration;

    /** The mass of the train, in kilograms. */
    public final double mass;

    /** Defined as mass * inertiaCoefficient */
    public final double inertia;

    /**
     * Inertia coefficient. The mass alone isn't sufficient to compute accelerations, as the wheels
     * and internals also need force to get spinning. This coefficient can be used to account for
     * the difference. It's without unit.
     */
    public final double inertiaCoefficient;

    public final RJSLoadingGaugeType loadingGaugeType;

    /**
     * Associates a speed to a force.
     * https://en.wikipedia.org/wiki/Tractive_force#Tractive_effort_curves
     */
    private final Map<String, ModeEffortCurves> modes;

    private final String defaultMode;
    public final String basePowerClass;
    public final Map<String, String> powerRestrictions;
    public final Double electricalPowerStartUpTime;
    public final Double raisePantographTime;

    public final String[] supportedSignalingSystems;

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
     * Gets the rolling resistance at a given speed, which is a force that always goes opposite to
     * the train's movement direction
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

    public record ModeEffortCurves(
            boolean isElectric, TractiveEffortPoint[] defaultCurve, ConditionalEffortCurve[] curves) {}

    public record ConditionalEffortCurve(EffortCurveConditions cond, TractiveEffortPoint[] curve) {}

    public record EffortCurveConditions(Comfort comfort, String electricalProfile, String powerRestriction) {
        /**
         * Returns true if the conditions are met If comfort condition is null then it matches any
         * comfort, same for electrical profile
         */
        public boolean match(EffortCurveConditions other) {
            return (this.comfort == null || other.comfort == this.comfort)
                    && (this.electricalProfile == null || this.electricalProfile.equals(other.electricalProfile))
                    && (this.powerRestriction == null || this.powerRestriction.equals(other.powerRestriction));
        }
    }

    public record InfraConditions(String mode, String electricalProfile, String powerRestriction) {}

    protected record CurveAndCondition(TractiveEffortPoint[] curve, InfraConditions cond) {}

    public record CurvesAndConditions(
            RangeMap<Double, TractiveEffortPoint[]> curves, RangeMap<Double, InfraConditions> conditions) {}

    /** Returns Gamma */
    public double getDeceleration() {
        return -gamma;
    }

    /**
     * Returns whether the train should coast while crossing this neutral section or use its
     * (thermal) traction
     */
    private boolean shouldCoast(Neutral n, Comfort comfort) {
        var overlappedCurve = findTractiveEffortCurve(comfort, n.overlappedElectrification);
        return modes.get(overlappedCurve.cond.mode).isElectric;
    }

    /**
     * Returns the tractive effort curve that matches best, along with the electrification
     * conditions that matched
     */
    protected CurveAndCondition findTractiveEffortCurve(Comfort comfort, Electrification electrification) {
        if (electrification instanceof Neutral n) {
            if (shouldCoast(n, comfort)) {
                return new CurveAndCondition(COASTING_CURVE, new InfraConditions(null, null, null));
            } else {
                return findTractiveEffortCurve(comfort, n.overlappedElectrification);
            }
        }
        if (electrification instanceof NonElectrified) {
            return new CurveAndCondition(
                    modes.get(defaultMode).defaultCurve, new InfraConditions(defaultMode, null, null));
        }

        var electrified = (Electrified) electrification;

        String usedMode = modes.containsKey(electrified.mode) ? electrified.mode : defaultMode;
        var mode = modes.get(usedMode);
        var chosenCond = new EffortCurveConditions(comfort, electrified.profile, electrified.powerRestriction);
        // Get first matching curve
        for (var condCurve : mode.curves) {
            if (condCurve.cond.match(chosenCond)) {
                return new CurveAndCondition(
                        condCurve.curve,
                        new InfraConditions(
                                usedMode, condCurve.cond.electricalProfile, condCurve.cond.powerRestriction));
            }
        }
        return new CurveAndCondition(mode.defaultCurve, new InfraConditions(usedMode, null, null));
    }

    /**
     * Returns the tractive effort curves corresponding to the electrical conditions map The neutral
     * sections are not extended in this function.
     *
     * @param electrificationMap The map of electrification conditions to use
     * @param comfort The comfort level to get the curves for
     */
    public CurvesAndConditions mapTractiveEffortCurves(
            RangeMap<Double, Electrification> electrificationMap, Comfort comfort) {
        TreeRangeMap<Double, InfraConditions> conditionsUsed = TreeRangeMap.create();
        TreeRangeMap<Double, TractiveEffortPoint[]> res = TreeRangeMap.create();

        for (var elecCondEntry : electrificationMap.asMapOfRanges().entrySet()) {
            var curveAndCond = findTractiveEffortCurve(comfort, elecCondEntry.getValue());
            res.put(elecCondEntry.getKey(), curveAndCond.curve);
            conditionsUsed.put(elecCondEntry.getKey(), curveAndCond.cond);
        }
        return new CurvesAndConditions(ImmutableRangeMap.copyOf(res), ImmutableRangeMap.copyOf(conditionsUsed));
    }

    /**
     * Returns the tractive effort curves corresponding to the electrical conditions map with
     * neutral sections
     *
     * @param electrificationMap The map of electrification conditions to use
     * @param comfort The comfort level to get the curves for
     * @param maxSpeedEnvelope The maxSpeedEnvelope used to extend the neutral sections
     */
    public RangeMap<Double, TractiveEffortPoint[]> addNeutralSystemTimes(
            RangeMap<Double, Electrification> electrificationMap,
            Comfort comfort,
            Envelope maxSpeedEnvelope,
            RangeMap<Double, TractiveEffortPoint[]> curvesUsed) {

        TreeRangeMap<Double, TractiveEffortPoint[]> newCurves = TreeRangeMap.create();
        newCurves.putAll(curvesUsed);

        for (var elecCondEntry : electrificationMap.asMapOfRanges().entrySet()) {
            if (elecCondEntry.getValue() instanceof Neutral n) {
                if (!shouldCoast(n, comfort)) {
                    continue;
                }
                // estimate the distance during which the train will be coasting, due to having
                // respected the
                // neutral section
                Range<Double> neutralRange = elecCondEntry.getKey();
                var deadSectionRange = Range.closed(neutralRange.lowerEndpoint(), neutralRange.upperEndpoint());
                var curveAndCondition = findTractiveEffortCurve(comfort, n);
                if (curveAndCondition.cond.mode == null) { // The train is effectively coasting
                    newCurves.put(deadSectionRange, curveAndCondition.curve);
                }
            }
        }
        return ImmutableRangeMap.copyOf(newCurves);
    }

    public Set<String> getModeNames() {
        return modes.keySet();
    }

    /** Return whether this rolling stock's default mode is thermal */
    public boolean isThermal() {
        return !modes.get(defaultMode).isElectric();
    }

    /** Return whether this rolling stock's has an electric mode */
    public final boolean isElectric() {
        return modes.values().stream().anyMatch(ModeEffortCurves::isElectric);
    }

    /** Creates a new rolling stock (a physical train inventory item). */
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
            String[] supportedSignalingSystems) {
        this(
                id,
                length,
                mass,
                inertiaCoefficient,
                a,
                b,
                c,
                maxSpeed,
                startUpTime,
                startUpAcceleration,
                comfortAcceleration,
                gamma,
                gammaType,
                loadingGaugeType,
                modes,
                defaultMode,
                basePowerclass,
                Map.of(),
                0.,
                0.,
                supportedSignalingSystems);
    }

    /** Creates a new rolling stock (a physical train inventory item). */
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
            Map<String, String> powerRestrictions,
            Double electricalPowerStartUpTime,
            Double raisePantographTime,
            String[] supportedSignalingSystems) {
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
        this.electricalPowerStartUpTime = electricalPowerStartUpTime;
        this.raisePantographTime = raisePantographTime;
        this.supportedSignalingSystems = supportedSignalingSystems;

        assert !isElectric() || (this.electricalPowerStartUpTime != null && this.raisePantographTime != null)
                : "Electrical power start up time and Raise pantograph time must be defined for an electric train";
    }
}
