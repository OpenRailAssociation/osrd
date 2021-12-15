package fr.sncf.osrd.train;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;


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

    /** the kind of deceleration input of the train. It can be:
     * a constant value
     * the maximum possible deceleration value */
    public final RollingStock.GammaType gammaType;

    /** the deceleration of the train, in m/s^2 */
    public final double gamma;

    public final String source;

    @Json(name = "verbose_name")
    public final String verboseName;

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

    public final TrainFeature[] features;

    /**
     * Associates a speed to a force.
     * https://en.wikipedia.org/wiki/Tractive_force#Tractive_effort_curves
     */
    public final TractiveEffortPoint[] tractiveEffortCurve;

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
    public double getMaxBrakingForce(double speed) {
        return gamma * inertia;
    }

    @Override
    public GammaType getGammaType() {
        return gammaType;
    }

    public enum GammaType {
        CONST,
        MAX
    }

    public static final class TractiveEffortPoint {
        public final double speed;
        public final double maxEffort;

        public TractiveEffortPoint(double speed, double maxEffort) {
            this.speed = speed;
            this.maxEffort = maxEffort;
        }
    }

    /** Returns Gamma */
    public double getDeceleration() {
        return - gamma;
    }

    /**
     * Returns the max tractive effort at a given speed.
     * @param speed the speed to compute the max tractive effort for
     * @return the max tractive effort
     */
    public double getMaxEffort(double speed) {
        double maxEffort = 0.0;
        for (var dataPoint : tractiveEffortCurve) {
            if (dataPoint.speed > Math.abs(speed))
                break;
            maxEffort = dataPoint.maxEffort;
        }
        return maxEffort;
    }

    // TODO masses

    /** Creates a new rolling stock (a physical train inventory item). */
    public RollingStock(
            String id,
            String source,
            String verboseName,
            double length,
            double mass,
            double inertiaCoefficient,
            double a,
            double b,
            double c,
            TrainFeature[] features,
            double maxSpeed,
            double startUpTime,
            double startUpAcceleration,
            double comfortAcceleration,
            double gamma,
            GammaType gammaType,
            TractiveEffortPoint[] tractiveEffortCurve
    ) {
        this.id = id;
        this.source = source;
        this.verboseName = verboseName;
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
        this.features = features;
        this.tractiveEffortCurve = tractiveEffortCurve;
        this.inertia = mass * inertiaCoefficient;
    }
}
