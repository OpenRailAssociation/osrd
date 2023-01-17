package fr.sncf.osrd.envelope_sim;

import com.google.common.collect.RangeMap;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.train.RollingStock.Comfort;

public interface PhysicsRollingStock {
    /** The mass of the train, in kilograms */
    double getMass();

    /** The inertia of the train, in newtons (usually computed from mass * inertiaCoefficient) */
    double getInertia();

    /** The length of the train, in meters */
    double getLength();

    /** The maximum speed the train can reach, in m/s */
    double getMaxSpeed();

    /** The type of gamma input of the train */
    RJSRollingStock.GammaType getGammaType();

    /** The resistance to movement at a given speed, in newtons */
    double getRollingResistance(double speed);

    /** The first derivative of the resistance to movement at a given speed, in kg/s */
    double getRollingResistanceDeriv(double speed);

    /** The second derivative of the resistance to movement at a given speed, in kg/m */
    double getRollingResistanceSecDeriv(double speed);

    /** The effort curves to use depending on the position on the path */
    RangeMap<Double, TractiveEffortPoint[]> mapTractiveEffortCurves(PhysicsPath path, Comfort comfort);

    /** Get the effort the train can apply at a given speed, in newtons */
    static double getMaxEffort(double speed, TractiveEffortPoint[] tractiveEffortCurve) {
        double previousEffort = 0.0;
        double previousSpeed = 0.0;
        for (var dataPoint : tractiveEffortCurve) {
            if (previousSpeed <= Math.abs(speed) && Math.abs(speed) < dataPoint.speed()) {
                var coeff = (previousEffort - dataPoint.maxEffort()) / (previousSpeed - dataPoint.speed());
                return previousEffort + coeff * (Math.abs(speed) - previousSpeed);
            }
            previousEffort = dataPoint.maxEffort();
            previousSpeed = dataPoint.speed();
        }
        return previousEffort;
    }

    /** The maximum constant deceleration, in m/s^2 */
    double getDeceleration();

    /** The maximum braking force which can be applied at a given speed, in newtons */
    double getMaxBrakingForce(double speed);

    /** The maximum acceleration, in m/s^2, which can be applied at a given speed, in m/s */
    record TractiveEffortPoint(double speed, double maxEffort) {
    }
}
