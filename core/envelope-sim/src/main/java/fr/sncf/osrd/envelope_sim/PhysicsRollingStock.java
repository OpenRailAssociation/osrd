package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.GRAVITY_ACCELERATION;
import static fr.sncf.osrd.envelope_sim.etcs.ConstantsKt.M_ROTATING_MAX;
import static fr.sncf.osrd.envelope_sim.etcs.ConstantsKt.M_ROTATING_MIN;

import fr.sncf.osrd.railjson.schema.rollingstock.RJSEtcsBrakeParams;

public interface PhysicsRollingStock {
    /** The mass of the train, in kilograms */
    double getMass();

    /** The inertia of the train, in newtons (usually computed from mass * inertiaCoefficient) */
    double getInertia();

    /** The length of the train, in meters */
    double getLength();

    /** The maximum speed the train can reach, in m/s */
    double getMaxSpeed();

    /** The resistance to movement at a given speed, in newtons */
    double getRollingResistance(double speed);

    /** The first derivative of the resistance to movement at a given speed, in kg/s */
    double getRollingResistanceDeriv(double speed);

    RJSEtcsBrakeParams getRJSEtcsBrakeParams();

    /** Get the effort the train can apply at a given speed, in newtons */
    static double getMaxEffort(double speed, TractiveEffortPoint[] tractiveEffortCurve) {
        int index = 0;
        int left = 0;
        int right = tractiveEffortCurve.length - 1;
        while (left <= right) {
            // this line is to calculate the mean of the two values
            int mid = (left + right) >>> 1;
            if (Math.abs(tractiveEffortCurve[mid].speed - Math.abs(speed)) < 0.000001) {
                index = mid;
                break;
            } else if (tractiveEffortCurve[mid].speed < Math.abs(speed)) {
                left = mid + 1;
                index = left;
            } else {
                right = mid - 1;
            }
        }
        if (index == 0) {
            return tractiveEffortCurve[0].maxEffort();
        }
        if (index == tractiveEffortCurve.length) {
            return tractiveEffortCurve[index - 1].maxEffort();
        }
        TractiveEffortPoint previousPoint = tractiveEffortCurve[index - 1];
        TractiveEffortPoint nextPoint = tractiveEffortCurve[index];
        double coeff =
                (previousPoint.maxEffort() - nextPoint.maxEffort()) / (previousPoint.speed() - nextPoint.speed());
        return previousPoint.maxEffort() + coeff * (Math.abs(speed) - previousPoint.speed());
    }

    /**
     * The gradient acceleration of the rolling stock taking its rotating mass into account, in m/s².
     * Grade is in m/km.
     * mRotating (Max or Min) is in %, as seen in ERA braking curves simulation tool v5.1.
     */
    static double getGradientAcceleration(double grade) {
        var mRotating = grade >= 0 ? M_ROTATING_MAX : M_ROTATING_MIN;
        return -GRAVITY_ACCELERATION * grade / (1000.0 + 10.0 * mRotating);
    }

    /** The maximum constant deceleration, in m/s^2 */
    double getDeceleration();

    /** The maximum acceleration, in m/s^2, which can be applied at a given speed, in m/s */
    record TractiveEffortPoint(double speed, double maxEffort) {}
}
