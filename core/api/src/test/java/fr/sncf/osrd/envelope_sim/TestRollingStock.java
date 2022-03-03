package fr.sncf.osrd.envelope_sim;

import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;

public class TestRollingStock implements PhysicsRollingStock {
    public final double A; // in newtons
    public final double B; // in newtons / (m/s)
    public final double C; // in newtons / (m/s^2)

    /** the kind of deceleration input of the train. It can be:
     * a constant value
     * the maximum possible deceleration value */
    public final RJSRollingStock.RJSGammaType gammaType;

    /** the deceleration of the train, in m/s^2 */
    public final double gamma;

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
    public double getRollingResistanceSecDeriv(double speed) {
        return 2 * C;
    }

    @Override
    public double getMaxBrakingForce(double speed) {
        return gamma * inertia;
    }

    @Override
    public RJSRollingStock.RJSGammaType getGammaType() {
        return gammaType;
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

    /** Creates a new rolling stock (a physical train inventory item). */
    public TestRollingStock(
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
            RJSRollingStock.RJSGammaType gammaType,
            TractiveEffortPoint[] tractiveEffortCurve
    ) {
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
        this.tractiveEffortCurve = tractiveEffortCurve;
        this.inertia = mass * inertiaCoefficient;
    }
}
