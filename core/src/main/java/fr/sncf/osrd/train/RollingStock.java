package fr.sncf.osrd.train;

import static fr.sncf.osrd.envelope_sim_infra.ertms.etcs.NationalDefaultData.*;
import static java.lang.Double.NaN;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStockField;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType;
import java.util.SortedMap;

/**
 * The immutable characteristics of a specific train.
 * There must be a RollingStock instance per train on the network.
 */
@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RollingStock implements PhysicsRollingStock {
    public final String id;

    public final double A; // in newtons
    public final double B; // in newtons / (m/s)
    public final double C; // in newtons / (m/s^2)

    /** the maximum braking force of the train, in N */
    public final double maxBrakingForce;

    /** the constant deceleration of the train use for timetable calculation, in m/s² */
    public final double timetableGamma;

    /** A_brake_emergency: the emergency braking decelerations for ERTMS ETCS 2, in m/s² */
    public final SortedMap<Double, Double> gammaEmergency;

    /** A_brake_service: the service braking decelerations for ERTMS ETCS 2, in m/s² */
    public final SortedMap<Double, Double> gammaService;

    /** A_brake_normal_service: the service braking decelerations used to compute guidance curve in ETCS 2, in m/s² */
    public final SortedMap<Double, Double> gammaNormalService;

    /** Kdry_rst: the rolling stock deceleration correction factors for dry rails, used in ETCS 2, expressed  */
    public final SortedMap<Double, Double> kDry;

    /** Kwet_rst: the rolling stock deceleration correction factors for wet rails, used in ETCS 2 */
    public final SortedMap<Double, Double> kWet;

    /** Kn+(V): the correction factor on normal service deceleration in positive gradients, used in ETCS 2 */
    public final SortedMap<Double, Double> kNPos;

    /** Kn+(V): the correction factor on normal service deceleration in negative gradients, used in ETCS 2 */
    public final SortedMap<Double, Double> kNNeg;

    /** Time delay from the traction cut off command to the moment the acceleration due to traction is zero */
    public double tTractionCutOff;

    /** Time service break used for SBI1 computation */
    public double tBs1;

    /** Time service break used for SBI2 computation */
    public double tBs2;

    /** Safe brake buildup time */
    public double tBe;

    /** the length of the train, in meters. */
    public final double length;

    /** The max speed of the train, in meters per seconds. */
    public final double maxSpeed;

    /**
     * The time the train takes to start up, in seconds.
     * During this time, the train's maximum acceleration is limited.
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
     * Inertia coefficient.
     * The mass alone isn't sufficient to compute accelerations, as the wheels and internals
     * also need force to get spinning. This coefficient can be used to account for the difference.
     * It's without unit.
     */
    public final double inertiaCoefficient;

    /**
     * Associates a speed to a force.
     * https://en.wikipedia.org/wiki/Tractive_force#Tractive_effort_curves
     */
    public final TractiveEffortPoint[] tractiveEffortCurve;

    public final RJSLoadingGaugeType loadingGaugeType;

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
    public double getTimetableDeceleration() {
        return -timetableGamma;
    }

    @Override
    public double getMaxBrakingForce(double speed) {
        return maxBrakingForce;
    }

    @Override
    public double getSafeBrakingForce(double speed) {
        assert gammaEmergency != null;
        var aBrakeEmergency = getEmergencyBrakingDeceleration(speed);
        var kDry = getRollingStockCorrectionFactorDry(speed, mNvebcl);
        var kWet = getRollingStockCorrectionFactorWet(speed);
        return kDry * (kWet + mNvavadh * (1 - kWet)) * aBrakeEmergency * inertia;
    }

    private double getEmergencyBrakingDeceleration(double speed) {
        assert gammaEmergency != null;
        for (var mapElement : gammaEmergency.entrySet()) {
            double mapSpeed = mapElement.getKey();
            if (Math.abs(speed) <= mapSpeed) {
                return mapElement.getValue();
            }
        }
        throw new InvalidRollingStockField("gammaEmergency", "no value for the given speed");
    }

    private double getRollingStockCorrectionFactorDry(double speed, double confidenceLevel) {
        assert kDry != null;
        for (var mapElement : kDry.entrySet()) {
            double mapSpeed = mapElement.getKey();
            if (Math.abs(speed) <= mapSpeed) {
                return mapElement.getValue() * confidenceLevel;
            }
        }
        throw new InvalidRollingStockField("kDry", "no value for the given speed");
    }

    private double getRollingStockCorrectionFactorWet(double speed) {
        assert kWet != null;
        for (var mapElement : kWet.entrySet()) {
            double mapSpeed = mapElement.getKey();
            if (Math.abs(speed) <= mapSpeed) {
                return mapElement.getValue();
            }
        }
        throw new InvalidRollingStockField("kWet", "no value for the given speed");
    }

    @Override
    public double getServiceBrakingForce(double speed) {
        assert gammaService != null;
        for (var mapElement : gammaService.entrySet()) {
            double mapSpeed = mapElement.getKey();
            if (Math.abs(speed) <= mapSpeed)
                return mapElement.getValue() * inertia;
        }
        throw new InvalidRollingStockField("gammaService", "no value for the given speed");
    }

    @Override
    public double getNormalServiceBrakingForce(double speed) {
        assert gammaNormalService != null;
        for (var mapElement : gammaNormalService.entrySet()) {
            double mapSpeed = mapElement.getKey();
            if (Math.abs(speed) <= mapSpeed)
                return mapElement.getValue() * inertia;
        }
        throw new InvalidRollingStockField("gammaNormalService", "no value for the given speed");
    }

    @Override
    public double getGradientCorrection(double grade, double speed) {
        assert kNPos != null;
        assert kNNeg != null;
        if (grade < 0) {
            for (var k : kNPos.entrySet()) {
                double mapSpeed = k.getKey();
                if (Math.abs(speed) <= mapSpeed)
                    return - k.getValue() * grade;
            }
            throw new InvalidRollingStockField("kNPos", "no value for the given speed");
        } else {
            for (var k : kNNeg.entrySet()) {
                double mapSpeed = k.getKey();
                if (Math.abs(speed) <= mapSpeed)
                    return - k.getValue() * grade;
            }
            throw new InvalidRollingStockField("kNNeg", "no value for the given speed");
        }
    }

    public static final class TractiveEffortPoint {
        public final double speed;
        public final double maxEffort;

        public TractiveEffortPoint(double speed, double maxEffort) {
            this.speed = speed;
            this.maxEffort = maxEffort;
        }
    }

    /**
     * Returns the max tractive effort at a given speed.
     * @param speed the speed to compute the max tractive effort for
     * @return the max tractive effort
     */
    public double getMaxEffort(double speed) {
        double previousEffort = 0.0;
        double previousSpeed = 0.0;
        for (var dataPoint : tractiveEffortCurve) {
            if (previousSpeed <= Math.abs(speed) && Math.abs(speed) < dataPoint.speed) {
                var coeff = (previousEffort - dataPoint.maxEffort) / (previousSpeed - dataPoint.speed);
                return previousEffort + coeff * (Math.abs(speed) - previousSpeed);
            }
            previousEffort = dataPoint.maxEffort;
            previousSpeed = dataPoint.speed;
        }
        return previousEffort;
    }

    // TODO masses

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
            double timetableGamma,
            double maxBrakingForce,
            TractiveEffortPoint[] tractiveEffortCurve,
            RJSLoadingGaugeType loadingGaugeType
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
        this.timetableGamma = timetableGamma;
        this.maxBrakingForce = maxBrakingForce;
        this.gammaEmergency = null;
        this.gammaService = null;
        this.gammaNormalService = null;
        this.kDry = null;
        this.kWet = null;
        this.kNPos = null;
        this.kNNeg = null;
        this.tTractionCutOff = NaN;
        this.tBs1 = NaN;
        this.tBs2 = NaN;
        this.tBe = NaN;
        this.mass = mass;
        this.inertiaCoefficient = inertiaCoefficient;
        this.tractiveEffortCurve = tractiveEffortCurve;
        this.inertia = mass * inertiaCoefficient;
        this.loadingGaugeType = loadingGaugeType;
    }

    /** Creates a new rolling stock adapted to ERTMS ETCS 2. */
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
            double timetableGamma,
            double maxBrakingForce,
            SortedMap<Double, Double> gammaBrakeEmergency,
            SortedMap<Double, Double> gammaBrakeService,
            SortedMap<Double, Double> gammaBrakeNormalService,
            SortedMap<Double, Double> kDry,
            SortedMap<Double, Double> kWet,
            SortedMap<Double, Double> kNPos,
            SortedMap<Double, Double> kNNeg,
            double tTractionCutOff,
            double tBs1,
            double tBs2,
            double tBe,
            TractiveEffortPoint[] tractiveEffortCurve,
            RJSLoadingGaugeType loadingGaugeType
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
        this.timetableGamma = timetableGamma;
        this.maxBrakingForce = maxBrakingForce;
        this.gammaEmergency = gammaBrakeEmergency;
        this.gammaService = gammaBrakeService;
        this.gammaNormalService = gammaBrakeNormalService;
        this.kDry = kDry;
        this.kWet = kWet;
        this.kNPos = kNPos;
        this.kNNeg = kNNeg;
        this.tTractionCutOff = tTractionCutOff;
        this.tBs1 = tBs1;
        this.tBs2 = tBs2;
        this.tBe = tBe;
        this.mass = mass;
        this.inertiaCoefficient = inertiaCoefficient;
        this.tractiveEffortCurve = tractiveEffortCurve;
        this.inertia = mass * inertiaCoefficient;
        this.loadingGaugeType = loadingGaugeType;
    }
}
