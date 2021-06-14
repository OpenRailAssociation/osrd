package fr.sncf.osrd.train;

import fr.sncf.osrd.RollingStock;
import fr.sncf.osrd.speedcontroller.SpeedDirective;
import fr.sncf.osrd.utils.Constants;

/**
 * An utility class to help simulate the train, using forward numerical integration.
 * It's used when simulating the train, and passed to speed controllers so they can take decisions
 * about what action to make. Once speed controllers took a decision, this same class is used to compute
 * the next position and speed of the train.
 */
public class TrainPhysicsIntegrator {
    private final double timeStep;
    private final double currentSpeed;
    private final double weightForce;
    private final double precomputedRollingResistance;
    private final double inertia;

    private TrainPhysicsIntegrator(
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
    public static TrainPhysicsIntegrator make(
            double timeStep,
            RollingStock rollingStock,
            double currentSpeed,
            double maxTrainGrade
    ) {
        // get an angle from a meter per km elevation difference
        var angle = Math.atan(maxTrainGrade / 1000.0);  // from m/km to m/m
        var weightForce = rollingStock.mass * Constants.GRAVITY * -Math.sin(angle);

        var inertia = rollingStock.mass * rollingStock.inertiaCoefficient;
        return new TrainPhysicsIntegrator(
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

    /** Computes the force required to keep some speed. */
    public Action actionToTargetSpeed(SpeedDirective speedDirective, RollingStock rollingStock) {
        // the force we'd need to apply to reach the target speed at the next step
        // F= m*a
        // a<0 dec force<0
        // a>0 acc force>0
        // normally the train speed should be positive

        if (Double.isNaN(speedDirective.allowedSpeed)) {
            return Action.coast();
        }

        assert currentSpeed >= 0;
        var targetForce = (speedDirective.allowedSpeed - currentSpeed) / timeStep * inertia;
        // limited the possible acceleration for reasons of travel comfort
        if (targetForce > rollingStock.comfortAcceleration * inertia)
            targetForce = rollingStock.comfortAcceleration * inertia;

        var weightForce = computeTotalForce(0, 0);

        // targetForce = actionForce + otherForces
        var actionForce = targetForce - weightForce;

        // we can't realistically accelerate and brake with infinite forces, so limit it to some given value
        if (actionForce >= 0) {
            var maxTraction = rollingStock.getMaxEffort(currentSpeed);
            if (actionForce > maxTraction)
                actionForce = maxTraction;
            return Action.accelerate(actionForce);
        }

        // if the resulting force is negative
        var maxBrakingForce = -rollingStock.timetableGamma * inertia;
        if (actionForce < maxBrakingForce)
            actionForce = maxBrakingForce;
        return Action.brake(Math.abs(actionForce));
    }

    public static class PositionUpdate {
        public final double timeDelta;
        public final double positionDelta;
        public final double speed;

        PositionUpdate(double timeDelta, double positionDelta, double speed) {
            this.timeDelta = timeDelta;
            this.positionDelta = positionDelta;
            this.speed = speed;
        }
    }

    private static double computePositionDelta(double currentSpeed, double acceleration, double timeStep) {
        // dx = currentSpeed * dt + 1/2 * acceleration * dt * dt
        return currentSpeed * timeStep + 0.5 * acceleration * timeStep * timeStep;
    }

    private static double computeTimeDelta(double currentSpeed, double acceleration, double positionDelta) {
        // Solve: acceleration / 2 * t^2 + currentSpeed * t - positionDelta = 0
        if (Math.abs(acceleration) < 0.00001)
            return positionDelta / currentSpeed;
        var numerator = -currentSpeed + Math.sqrt(currentSpeed * currentSpeed + 2 * positionDelta * acceleration);
        var res = numerator / acceleration;
        return res;
    }

    /**
     * Compute the train's acceleration given an action
     * @param action the action made by the driver
     * @param maxDistance the maximum distance the train can go
     * @return the new speed of the train
     */
    public PositionUpdate computeUpdate(Action action, double maxDistance, double directionSign) {
        return computeUpdate(action.tractionForce(), action.brakingForce(), maxDistance, directionSign);
    }

    public PositionUpdate computeUpdate(Action action, double maxDistance) {
        return computeUpdate(action, maxDistance, 1);
    }

    public PositionUpdate computeUpdate(double actionTractionForce, double actionBrakingForce, double maxDistance) {
        return computeUpdate(actionTractionForce, actionBrakingForce, maxDistance, 1);
    }

    /**
     * Compute the train's acceleration given an action force
     * @param actionTractionForce the force indirectly applied by the driver
     * @param actionBrakingForce the braking force indirectly applied by the driver
     * @param maxDistance the maximum distance the train can go
     * @return the new speed of the train
     */
    public PositionUpdate computeUpdate(double actionTractionForce, double actionBrakingForce, double maxDistance,
                                        double directionSign) {
        // the rolling resistance is the sum of forces that always go the direction
        // opposite to the train's movement
        assert actionBrakingForce >= 0.;
        
        // the absolute value of forces opposite to the direction of movement
        // the active rolling resistance is the train's braking force
        // the passive rolling resistance is the sum of other friction parameters, which apply no matter what
        var rollingResistance = precomputedRollingResistance + actionBrakingForce;

        // as the rolling resistance is a reaction force, it needs to be adjusted to be opposed to the other forces
        double effectiveRollingResistance;
        if (currentSpeed == 0.0) {
            var totalOtherForce = computeTotalForce(0.0, actionTractionForce);
            // if the train is stopped and the rolling resistance is greater in amplitude than the other forces,
            // the train won't move
            if (Math.abs(totalOtherForce) < rollingResistance)
                return new PositionUpdate(timeStep, 0.0, 0.0);
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
        var fullStepAcceleration = computeAcceleration(directionSign * effectiveRollingResistance,
                actionTractionForce);
        var newSpeed = currentSpeed + fullStepAcceleration * timeStep;

        // when the train changes direction, the rolling resistance doesn't apply
        // in the same direction for all the integration step.

        var timeDelta = timeStep;

        // if the speed change sign we integrate only the step at which the speed is zero
        if (currentSpeed != 0.0 && Math.signum(newSpeed) != Math.signum(currentSpeed)) {
            timeDelta = -currentSpeed / fullStepAcceleration;
            newSpeed = 0.;
        }

        // TODO the integration of the rolling resistance
        var newPositionDelta = computePositionDelta(currentSpeed, fullStepAcceleration, timeDelta);

        if (newPositionDelta <= maxDistance)
            return new PositionUpdate(timeDelta, newPositionDelta, newSpeed);

        timeDelta = computeTimeDelta(currentSpeed, fullStepAcceleration, maxDistance);
        assert timeDelta < timeStep && timeDelta > 0;
        newSpeed = currentSpeed + fullStepAcceleration * timeDelta;
        return  new PositionUpdate(timeDelta, maxDistance, newSpeed);
    }
}
