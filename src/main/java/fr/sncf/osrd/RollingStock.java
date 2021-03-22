package fr.sncf.osrd;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.train.TrainCapability;


/**
 * The immutable characteristics of a specific train.
 * There must be a RollingStock instance per train on the network.
 */
@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RollingStock {
    public final String id;

    private final double A; // in newtons
    private final double B; // in newtons / (m/s)
    private final double C; // in newtons / (m/s^2)

    /**
     * Gets the rolling resistance at a given speed, which is a force that always goes
     * opposite to the train's movement direction
     */
    public double rollingResistance(double speed) {
        speed = Math.abs(speed);
        // this formula is called the Davis equation.
        // it's completely empirical, and models the drag and friction forces
        return A + B * speed + C * speed * speed;
    }

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

    /** The naive braking deceleration coefficient for timetabling. */
    public final double timetableGamma;

    /** The mass of the train, in kilograms. */
    public final double mass;

    /**
     * Inertia coefficient.
     * The mass alone isn't sufficient to compute accelerations, as the wheels and internals
     * also need force to get spinning. This coefficient can be used to account for the difference.
     * It's without unit.
     */
    public final double inertiaCoefficient;

    public final TrainCapability[] capabilities;

    /**
     * Associates a speed to a force.
     * https://en.wikipedia.org/wiki/Tractive_force#Tractive_effort_curves
     */
    public final TractiveEffortPoint[] tractiveEffortCurve;

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
        double maxEffort = 0.0;
        for (var dataPoint : tractiveEffortCurve) {
            if (dataPoint.speed > speed)
                break;
            maxEffort = dataPoint.maxEffort;
        }
        return maxEffort;
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
            TrainCapability[] capabilities,
            double maxSpeed,
            double startUpTime,
            double startUpAcceleration,
            double comfortAcceleration,
            double timetableGamma,
            TractiveEffortPoint[] tractiveEffortCurve
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
        this.mass = mass;
        this.inertiaCoefficient = inertiaCoefficient;
        this.capabilities = capabilities;
        this.tractiveEffortCurve = tractiveEffortCurve;
    }
}
