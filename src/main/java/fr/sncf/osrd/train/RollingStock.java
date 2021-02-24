package fr.sncf.osrd.train;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.infra.InvalidInfraException;


/**
 * The immutable characteristics of a specific train.
 * There must be a RollingStock instance per train on the network.
 */
public class RollingStock {
    public static final JsonAdapter<RollingStock> adapter = new Moshi
            .Builder()
            .build()
            .adapter(RollingStock.class);

    /*
    These three coefficients are required for the train's physical simulation.

    https://www.sciencedirect.com/science/article/pii/S2210970616300415

    A = rollingResistance
    B = mechanicalResistance
    C = aerodynamicResistance

    R = (
        A
        + B * v
        + C * v^2
    )

    /!\ Be careful when importing data, conversions are needed /!\

    // configurationFile ?
    rollingResistance = cfg.getDouble("A") * mass / 100.0; // from dN/ton to N
    mechanicalResistance = cfg.getDouble("B") * mass / 100 * 3.6D; // from dN/ton/(km/h) to N
    aerodynamicResistance = cfg.getDouble("C") * mass / 100 * Math.pow(3.6D, 2); // from dN/ton/(km/h)2 to N

    // Json case
    rollingResistance = json.getDouble("coeffvoma") * 10; // from dN to N
    mechanicalResistance = json.getDouble("coeffvomb") * 10 * 3.6D; // from dN/(km/h) to N/(m/s)
    aerodynamicResistance = json.getDouble("coeffvomc") * 10 * Math.pow(3.6D, 2); // from dN/(km/h)2 to N/(m/s)2
    */

    @Json(name = "rolling_resistance")
    private final double rollingResistance;      // in newtons
    @Json(name = "mechanical_resistance")
    private final double mechanicalResistance;   // in newtons / (m/s)
    @Json(name = "aerodynamic_resistance")
    private final double aerodynamicResistance;  // in newtons / (m/s^2)

    /**
     * Gets the rolling resistance at a given speed, which is a force that always goes
     * opposite to the train's movement
     * @param speed the speed to compute the rolling resistance for
     * @return the rolling resistance force, in newtons
     */
    @SuppressWarnings({"checkstyle:LocalVariableName", "UnnecessaryLocalVariable"})
    public double rollingResistance(double speed) {
        speed = Math.abs(speed);
        var A = rollingResistance;
        var B = mechanicalResistance;
        var C = aerodynamicResistance;
        // this formula is called the Davis equation.
        // it's completely empirical, and models the drag and friction forces
        return A + B * speed + C * speed * speed;
    }

    /** the length of the train, in meters. */
    public final double length;

    /** The max speed of the train, in meters per seconds. */
    @Json(name = "max_speed")
    public final double maxSpeed;

    /**
     * The time the train takes to start up, in seconds.
     * During this time, the train's maximum acceleration is limited.
     */
    @Json(name = "startup_time")
    public final double startUpTime;

    /** The acceleration to apply during the startup state. */
    @Json(name = "startup_acceleration")
    public final double startUpAcceleration;

    /** The maximum acceleration when the train is in its regular operating mode. */
    @Json(name = "comfort_acceleration")
    public final double comfortAcceleration;

    /** The naive braking deceleration coefficient for timetabling. */
    @Json(name = "timetable_gamma")
    public final double timetableGamma;

    /** The mass of the train, in kilograms. */
    public final double mass;

    /**
     * Inertia coefficient.
     * The mass alone isn't sufficient to compute accelerations, as the wheels and internals
     * also need force to get spinning. This coefficient can be used to account for the difference.
     * It's without unit.
     */
    @Json(name = "inertia_coefficient")
    public final double inertiaCoefficient;

    public final TrainFeatures[] features;

    /**
     * Associates a speed to a force.
     * https://en.wikipedia.org/wiki/Tractive_force#Tractive_effort_curves
     */
    @Json(name = "tractive_effort_curve")
    public final TractiveEffortPoint[] tractiveEffortCurve;

    public static final class TractiveEffortPoint {
        public final double speed;
        @Json(name = "max_effort")
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

    /**
     * Creates a new train inventory item.
     * @param rollingResistance a rolling resistance coefficient, in newtons
     * @param mechanicalResistance a mechanical resistance coefficient, in newtons
     * @param aerodynamicResistance an aerodynamic resistance coefficient, in newtons
     * @param length the length of the train, in meters
     * @param maxSpeed the max speed, in m/s
     * @param startUpTime the train startup time, in seconds
     * @param startUpAcceleration the maximum acceleration during startup, in m/s^2
     * @param comfortAcceleration the cruise maximum acceleration, in m/s^2
     * @param mass the mass of the train, in kilograms
     * @param inertiaCoefficient a special inertia coefficient
     * @param features whether the train has TVM300 hardware
     * @param tractiveEffortCurve the tractive effort curve for the train
     */
    public RollingStock(
            double rollingResistance,
            double mechanicalResistance,
            double aerodynamicResistance,
            double length,
            double maxSpeed,
            double startUpTime,
            double startUpAcceleration,
            double comfortAcceleration,
            double timetableGamma,
            double mass,
            double inertiaCoefficient,
            TrainFeatures[] features,
            TractiveEffortPoint[] tractiveEffortCurve
    ) throws InvalidInfraException {
        this.rollingResistance = rollingResistance;
        this.mechanicalResistance = mechanicalResistance;
        this.aerodynamicResistance = aerodynamicResistance;
        this.length = length;
        this.maxSpeed = maxSpeed;
        this.startUpTime = startUpTime;
        this.startUpAcceleration = startUpAcceleration;
        this.comfortAcceleration = comfortAcceleration;
        this.timetableGamma = timetableGamma;
        this.mass = mass;
        this.inertiaCoefficient = inertiaCoefficient;
        this.features = features;
        this.tractiveEffortCurve = tractiveEffortCurve;
        validate();
    }

    /**
     * Validates the properties of the rolling stock
     * @throws InvalidInfraException if some property is invalid
     */
    public void validate() throws InvalidInfraException {
        if (rollingResistance < 0)
            throw new InvalidInfraException("Invalid rolling stock rollingResistance");

        if (mechanicalResistance < 0)
            throw new InvalidInfraException("Invalid rolling stock mechanicalResistance");

        if (aerodynamicResistance < 0)
            throw new InvalidInfraException("Invalid rolling stock aerodynamicResistance");

        if (length <= 0)
            throw new InvalidInfraException("invalid rolling stock length");

        if (mass <= 0)
            throw new InvalidInfraException("invalid rolling stock mass");

        if (inertiaCoefficient <= 0)
            throw new InvalidInfraException("Invalid rolling stock inertia coefficient");

        if (timetableGamma <= 0)
            throw new InvalidInfraException("Invalid timetableGamma");
    }
}
