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

    public static class PositionUpdate {
        public final double positionDelta;
        public final double speed;

        PositionUpdate(double positionDelta, double speed) {
            this.positionDelta = positionDelta;
            this.speed = speed;
        }
    }

    private static double computePositionDelta(double currentSpeed, double acceleration, double timeStep) {
        // dx = currentSpeed * dt + 1/2 * acceleration * dt * dt
        return currentSpeed * timeStep * 0.5 * acceleration * timeStep * timeStep;
    }

    /**
     * Compute the train's acceleration given an action force
     * @param actionTractionForce the force indirectly applied by the driver
     * @param actionBrakingForce the braking force indirectly applied by the driver
     * @return the new speed of the train
     */
    public PositionUpdate computeUpdate(double actionTractionForce, double actionBrakingForce) {
        // the rolling resistance is the sum of forces that always go the direction
        // opposite to the train's movement
        assert actionBrakingForce >= 0.;
        var rollingResistance = precomputedRollingResistance + actionBrakingForce;

        // as the rolling resistance is a reaction force, it needs to be adjusted to be opposed to the other forces
        double effectiveRollingResistance;
        if (currentSpeed == 0.0) {
            var totalOtherForce = computeTotalForce(0.0, actionTractionForce);
            // if the train is stopped and the rolling resistance is greater in amplitude than the other forces,
            // the train won't move
            if (Math.abs(totalOtherForce) < rollingResistance)
                return new PositionUpdate(0.0, 0.0);
            // if the sum of other forces isn't sufficient to keep the train still, the rolling resistance
            // will be opposed to the movement direction (which is the direction of the other forces)
            effectiveRollingResistance = Math.copySign(rollingResistance, -totalOtherForce);
        } else {
            // if the train is moving, the rolling resistance if opposed to the movement
            effectiveRollingResistance = Math.copySign(rollingResistance, -currentSpeed);
        }

        // general case: compute the acceleration and new position
        // compute the acceleration on all the integration step. the variable is named this way because be
        // compute the acceleration on only a part of the integration step below
        var fullStepAcceleration = computeAcceleration(effectiveRollingResistance, actionTractionForce);
        var newSpeed = currentSpeed + fullStepAcceleration * timeStep;

        // when the train changes direction, the rolling resistance doesn't apply
        // in the same direction for all the integration step.

        // general case: if the speed doesn't change sign, there's no need to
        // fixup the integration of the rolling resistance
        if (Math.signum(newSpeed) == Math.signum(currentSpeed))
            return new PositionUpdate(computePositionDelta(currentSpeed, fullStepAcceleration, timeStep), newSpeed);

        // compute the integration step at which the speed is zero
        // currentSpeed + signChangeTimeStep * fullStepAcceleration = 0
        // or
        // finalSpeed - currentSpeed = signChangeTimeStep * fullStepAcceleration, where finalSpeed = 0
        double signChangeTimeStep = -currentSpeed / fullStepAcceleration;

        var remainingStep = timeStep - signChangeTimeStep;

        // the integral of the speed up to the sign change
        var signChangePositionDelta = computePositionDelta(currentSpeed, fullStepAcceleration, signChangeTimeStep);

        var totalOtherForce = computeTotalForce(0.0, actionTractionForce);
        if (Math.abs(totalOtherForce) <= rollingResistance)
            return new PositionUpdate(signChangePositionDelta, 0.0);

        effectiveRollingResistance = Math.copySign(rollingResistance, -totalOtherForce);
        var remainingStepAcceleration = computeAcceleration(effectiveRollingResistance, actionTractionForce);
        var remainingPositionDelta = computePositionDelta(0.0, remainingStepAcceleration, remainingStep);
        newSpeed = 0.0 + remainingStepAcceleration * remainingStep;
        return new PositionUpdate(signChangePositionDelta + remainingPositionDelta, newSpeed);
    }
}
