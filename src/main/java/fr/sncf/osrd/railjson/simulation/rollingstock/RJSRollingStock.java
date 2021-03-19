package fr.sncf.osrd.railjson.simulation.rollingstock;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.common.Identified;

public class RJSRollingStock implements Identified {
    /** An unique train identifier */
    public final String id;

    /** the length of the train, in meters. */
    public final double length;

    /** The mass of the train, in kilograms. */
    public final double mass;

    /**
     * Inertia coefficient.
     * The mass alone isn't sufficient to compute accelerations, as the wheels and internals
     * also need force to get spinning. This coefficient can be used to account for the difference.
     * It's without unit: effective mass = mass * inertia coefficient
     */
    @Json(name = "inertia_coefficient")
    public final double inertiaCoefficient;

    /** The rolling resistance force formula */
    @Json(name = "rolling_resistance")
    public final RJSRollingResistance rollingResistance;

    /** The list of capabilities (protection systems, signaling equipment) the train is able to deal with */
    public final RJSTrainCapability[] capabilities;

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

    /**
     * Associates a speed to a force.
     * https://en.wikipedia.org/wiki/Tractive_force#Tractive_effort_curves
     */
    @Json(name = "tractive_effort_curve")
    public final RJSRollingStock.TractiveEffortPoint[] tractiveEffortCurve;

    /** Creates a new rolling stock */
    public RJSRollingStock(
            String id,
            double length,
            double mass,
            double inertiaCoefficient,
            RJSRollingResistance rollingResistance,
            RJSTrainCapability[] capabilities,
            double maxSpeed,
            double startUpTime,
            double startUpAcceleration,
            double comfortAcceleration,
            double timetableGamma,
            TractiveEffortPoint[] tractiveEffortCurve
    ) {
        this.id = id;
        this.length = length;
        this.mass = mass;
        this.inertiaCoefficient = inertiaCoefficient;
        this.rollingResistance = rollingResistance;
        this.capabilities = capabilities;
        this.maxSpeed = maxSpeed;
        this.startUpTime = startUpTime;
        this.startUpAcceleration = startUpAcceleration;
        this.comfortAcceleration = comfortAcceleration;
        this.timetableGamma = timetableGamma;
        this.tractiveEffortCurve = tractiveEffortCurve;
    }

    public static final class TractiveEffortPoint {
        public final double speed;
        @Json(name = "max_effort")
        public final double maxEffort;

        public TractiveEffortPoint(double speed, double maxEffort) {
            this.speed = speed;
            this.maxEffort = maxEffort;
        }
    }

    @Override
    public String getID() {
        return id;
    }
}
