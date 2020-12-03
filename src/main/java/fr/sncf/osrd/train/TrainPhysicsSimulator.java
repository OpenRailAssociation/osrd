package fr.sncf.osrd.train;

import fr.sncf.osrd.util.Constants;

/**
 * An utility class to help simulate the train, using forward numerical integration.
 */
public class TrainPhysicsSimulator {
    private final double timeStep;
    private final double currentSpeed;
    private final double weightForce;
    private final double precomputedRollingResistance;
    private final double inertia;

    private TrainPhysicsSimulator(
            double timeStep,
            double currentSpeed,
            double weightForce,
            double precomputedRollingResistance,
            double inertia
    ) {
        this.timeStep = timeStep;
        this.currentSpeed = currentSpeed;
        this.weightForce = weightForce;
        assert precomputedRollingResistance >= 0.;
        this.precomputedRollingResistance = precomputedRollingResistance;
        this.inertia = inertia;
    }

    /**
     * Makes a new train physics simulator
     * @param rollingStock the specs of the train
     * @param currentSpeed the current speed of the train
     * @param maxTrainGrade the maximum slope under the train
     * @return a new train physics simulator
     */
    public static TrainPhysicsSimulator make(
            double timeStep,
            RollingStock rollingStock,
            double currentSpeed,
            double maxTrainGrade
    ) {
        // get an angle from a meter per km elevation difference
        var angle = Math.atan(maxTrainGrade / 1000.0);  // from m/km to m/m
        var weightForce = rollingStock.mass * Constants.GRAVITY * -Math.sin(angle);

        var inertia = rollingStock.mass * rollingStock.inertiaCoefficient;
        return new TrainPhysicsSimulator(
                timeStep,
                currentSpeed,
                weightForce,
                rollingStock.rollingResistance(currentSpeed),
                inertia);
    }

    /**
     * (Internal) Computes the sum of forces acting on the train
     * @param rollingResistance the sum of rolling resistance forces (including braking)
     * @param actionTractionForce the traction force
     * @return the force vector for the train
     */
    private double computeTotalForce(double rollingResistance, double actionTractionForce) {
        return actionTractionForce + weightForce + rollingResistance;
    }

    /**
     * (Internal) Computes the raw acceleration, given the traction and rolling resistance.
     * @param rollingResistance the sum of rolling resistance forces (including braking)
     * @param actionTractionForce the traction force
     * @return the acceleration for the train
     */
    private double computeAcceleration(double rollingResistance, double actionTractionForce) {
        return computeTotalForce(rollingResistance, actionTractionForce) / inertia;
    }

    /**
     * As the rolling resistance always goes against movement, it may not always entirely apply.
     * This function computes what rolling resistance to use.
     * @param speed the current speed
     * @param rollingResistance the maximum rolling resistance
     * @param actionTractionForce the action traction force
     * @return the effective rolling resistance
     */
    private double computeEffectiveRollingResistance(
            double speed,
            double rollingResistance,
            double actionTractionForce
    ) {
        // the rolling resistance is going opposite the current direction in the general case.
        // is the speed is 0, then is all depends on what way the train is going without it
        if (speed != 0.0)
            return Math.copySign(rollingResistance, -speed);

        // compute the sum of forces acting on the train, without rolling resistance
        var totalForce = computeTotalForce(0.0, actionTractionForce);

        // if the rolling resistance overcomes the sum of other forces, it perfectly balances
        var totalForceAmplitude = Math.abs(totalForce);
        if (rollingResistance > totalForceAmplitude)
            rollingResistance = totalForceAmplitude;

        // the rolling resistance goes against the other forces
        return Math.copySign(rollingResistance, -totalForce);
    }

    /**
     * Compute the train's acceleration given an action force
     * @param actionTractionForce the force indirectly applied by the driver
     * @param actionBrakingForce the braking force indirectly applied by the driver
     * @return the new speed of the train
     */
    public double computeNewSpeed(double actionTractionForce, double actionBrakingForce) {
        // the rolling resistance is the sum of forces that always go the direction
        // opposite to the train's movement
        assert actionBrakingForce >= 0.;
        var rollingResistance = precomputedRollingResistance + actionBrakingForce;

        double effectiveRollingResistance = computeEffectiveRollingResistance(
                currentSpeed, rollingResistance, actionTractionForce);

        // general case: compute the acceleration and new position
        var fullStepAcceleration = computeAcceleration(effectiveRollingResistance, actionTractionForce);
        var newSpeed = currentSpeed + fullStepAcceleration * timeStep;

        assert !Double.isNaN(newSpeed);

        // when the train changes direction, the rolling resistance doesn't apply
        // in the same direction for all the integration step.

        // general case: if the speed doesn't change sign, there's no need to
        // fixup the integration of the rolling resistance
        if (Math.signum(newSpeed) == Math.signum(currentSpeed))
            return newSpeed;

        // compute the integration step at which the speed is zero
        double zeroStep = -currentSpeed / fullStepAcceleration;

        var remainingStep = timeStep - zeroStep;
        // we have to recompute the effective rolling resistance for a 0 speed
        effectiveRollingResistance = computeEffectiveRollingResistance(
                0.0, rollingResistance, actionTractionForce);
        newSpeed = 0.0 + computeAcceleration(-effectiveRollingResistance, actionTractionForce) * remainingStep;
        assert !Double.isNaN(newSpeed);
        return newSpeed;
    }
}
