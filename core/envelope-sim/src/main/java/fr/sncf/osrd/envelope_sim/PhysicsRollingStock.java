package fr.sncf.osrd.envelope_sim;


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
    GammaType getGammaType();

    /** The resistance to movement at a given speed, in newtons */
    double getRollingResistance(double speed);

    /** The first derivative of the resistance to movement at a given speed, in kg/s */
    double getRollingResistanceDeriv(double speed);

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

    /** The maximum constant deceleration, in m/s^2 */
    double getDeceleration();

    /** The maximum braking force which can be applied at a given speed, in newtons */
    double getMaxBrakingForce(double speed);

    /** The maximum acceleration, in m/s^2, which can be applied at a given speed, in m/s */
    record TractiveEffortPoint(double speed, double maxEffort) {
    }

    enum GammaType {
        CONST,
        MAX
    }
}
