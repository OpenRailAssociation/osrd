package fr.sncf.osrd.train;

import fr.sncf.osrd.RollingStock;
import fr.sncf.osrd.speedcontroller.SpeedDirective;
import fr.sncf.osrd.utils.Constants;

/**
 * An utility class to help simulate the train, using forward numerical integration.
 * It's used when simulating the train, and it is passed to speed controllers so they can take decisions
 * about what action to make. Once speed controllers took a decision, this same class is used to compute
 * the next position and speed of the train.
 */
public class TrainPhysicsIntegrator {
    private final double timeStep;
    private final double currentSpeed;
    private final double currentAccel;
    private final double weightForce;
    private final double rollingResistance;
    private final double inertia;

    // TODO : add a real jerk value, in the configuration files
    private final double jerk = .6;


    private TrainPhysicsIntegrator(
            double timeStep,
            double currentSpeed,
            double currentAccel,
            double weightForce,
            double rollingResistance,
            double inertia
    ) {
        this.timeStep = timeStep;
        this.currentSpeed = currentSpeed;
        this.currentAccel = currentAccel;
        this.weightForce = weightForce;
        assert rollingResistance >= 0.;
        this.rollingResistance = rollingResistance;
        this.inertia = inertia;
    }

    /**
     * Makes a new train physics simulator
     * @param rollingStock the specs of the train
     * @param currentSpeed the current speed of the train
     * @param meanTrainGrade the maximum slope under the train
     * @return a new train physics simulator
     */
    public static TrainPhysicsIntegrator make(
            double timeStep,
            RollingStock rollingStock,
            double currentSpeed,
            double meanTrainGrade
    ) {
        // get an angle from a meter per km elevation difference
        // the curve's radius is taken into account in meanTrainGrade
        var angle = Math.atan(meanTrainGrade / 1000.0);  // from m/km to m/m
        var weightForce = - rollingStock.mass * Constants.GRAVITY * Math.sin(angle);
        var inertia = rollingStock.mass * rollingStock.inertiaCoefficient;
        return new TrainPhysicsIntegrator(
                timeStep,
                currentSpeed,
                0.0,
                weightForce,
                rollingStock.rollingResistance(currentSpeed),
                inertia);
    }

    public static TrainPhysicsIntegrator make(
            double timeStep,
            RollingStock rollingStock,
            double currentSpeed,
            double currentAccel,
            double meanTrainGrade
    ) {
        // get an angle from a meter per km elevation difference
        // the curve's radius is taken into account in meanTrainGrade
        var angle = Math.atan(meanTrainGrade / 1000.0);  // from m/km to m/m
        var weightForce = - rollingStock.mass * Constants.GRAVITY * Math.sin(angle);
        var inertia = rollingStock.mass * rollingStock.inertiaCoefficient;
        return new TrainPhysicsIntegrator(
                timeStep,
                currentSpeed,
                currentAccel,
                weightForce,
                rollingStock.rollingResistance(currentSpeed),
                inertia);
    }

    /**
     * (Internal) Computes the sum of forces acting on the train
     * @param oppositeForces the sum of opposite forces (including braking)
     * @param actionTractionForce the traction force
     * @return the force vector for the train
     */
    private double computeTotalForce(double oppositeForces, double actionTractionForce) {
        return actionTractionForce + weightForce + oppositeForces;
    }

    /** Get the max braking force if it exists or the average time table braking force. */
    public double getBrakingForce(RollingStock rollingStock) {
        return -rollingStock.gamma * inertia;
    }

    /** Computes the force required to reach the target speed. */
    public Action actionToTargetSpeed(SpeedDirective speedDirective, RollingStock rollingStock) {
        return actionToTargetSpeed(speedDirective, rollingStock, 1);
    }

    /** Computes the force required to reach the target speed. */
    public Action actionToTargetSpeed(SpeedDirective speedDirective, RollingStock rollingStock, double directionSign) {
        // the force we'd need to apply to reach the target speed at the next step
        // F= m*a
        // a<0 dec force<0
        // a>0 acc force>0
        // normally the train speed should be positive
        assert currentSpeed >= 0;

        // this is used to compute Mareco allowance
        if (Double.isNaN(speedDirective.allowedSpeed)) {
            return Action.coast();
        }

        // if we're calculating backwards currentSpeed is > speedDirective.allowedSpeed
        var targetForce = directionSign * (speedDirective.allowedSpeed - currentSpeed) / timeStep * inertia;
        // limited the possible acceleration for reasons of travel comfort
        if (targetForce > rollingStock.comfortAcceleration * inertia)
            targetForce = rollingStock.comfortAcceleration * inertia;

        // targetForce = actionForce - mass * g * decl - Ra
        // targetForce = actionForce + weightForce - Ra = actionForce + weightForce + oppositeForces
        var actionForce = targetForce - weightForce + rollingResistance;

        // we can't realistically accelerate with infinite forces, so limit it to some given value
        if (actionForce >= 0) {
            var maxTraction = rollingStock.getMaxEffort(currentSpeed);
            if (actionForce > maxTraction)
                actionForce = maxTraction;
            return Action.accelerate(actionForce);
        }

        // if the resulting force is negative limit the value to the maxBrakingForce
        var maxBrakingForce = getBrakingForce(rollingStock);
        // TODO implement speed controllers with non constant deceleration
        if (actionForce < maxBrakingForce)
            actionForce = maxBrakingForce - rollingResistance - weightForce;
        return Action.brake(Math.abs(actionForce));
    }

    public static class PositionUpdate {
        public final double timeDelta;
        public final double positionDelta;
        public final double speed;
        public final double accel;

        PositionUpdate(double timeDelta, double positionDelta, double speed, double accel) {
            this.timeDelta = timeDelta;
            this.positionDelta = positionDelta;
            this.speed = speed;
            this.accel = accel;
        }
    }

    private static double computePositionDelta(double currentSpeed, double acceleration,
                                               double timeStep, double directionSign) {
        // dx = currentSpeed * dt + 1/2 * acceleration * dt * dt
        var positionDelta = currentSpeed * timeStep + 0.5 * acceleration * timeStep * timeStep;
        return directionSign * positionDelta;
    }

    private static double computeTimeDelta(double currentSpeed, double acceleration, double positionDelta) {
        // Solve: acceleration / 2 * t^2 + currentSpeed * t - positionDelta = 0
        if (Math.abs(acceleration) < 0.00001)
            return positionDelta / currentSpeed;
        var numerator = -currentSpeed + Math.sqrt(currentSpeed * currentSpeed + 2 * positionDelta * acceleration);
        return numerator / acceleration;
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
     * @param actionTractionForce the force directly applied by the driver
     * @param actionBrakingForce the braking force directly applied by the driver
     * @param maxDistance the maximum distance the train can go
     * @return the new speed of the train
     */
    public PositionUpdate computeUpdate(double actionTractionForce, double actionBrakingForce, double maxDistance,
                                        double directionSign) {
        assert actionBrakingForce >= 0.;

        // the sum of forces that always go the direction opposite to the train's movement
        double oppositeForce = rollingResistance + actionBrakingForce;

        // as the oppositeForces is a reaction force, it needs to be adjusted to be opposed to the other forces
        double effectiveOppositeForces;
        if (currentSpeed == 0.0) {
            var totalOtherForce = computeTotalForce(0.0, actionTractionForce);
            // if the train is stopped and the rolling resistance is greater in amplitude than the other forces,
            // the train won't move
            if (Math.abs(totalOtherForce) < oppositeForce)
                return new PositionUpdate(timeStep, 0.0, 0.0, 0.0);
            // if the sum of other forces isn't sufficient to keep the train still, the rolling resistance
            // will be opposed to the movement direction (which is the direction of the other forces)
            effectiveOppositeForces = Math.copySign(oppositeForce, -totalOtherForce);
        } else {
            // if the train is moving, the rolling resistance if opposed to the movement
            effectiveOppositeForces = Math.copySign(oppositeForce, -currentSpeed);
        }

        // general case: compute the acceleration and new position
        // compute the acceleration on all the integration step. the variable is named this way because we
        // compute the acceleration on only a part of the integration step below
        var fullStepAcceleration =  computeTotalForce(effectiveOppositeForces, actionTractionForce) / inertia;

        // the variation of the acceleration can't realistically be infinite, we have to limit it, with the jerk
        if (Math.abs(fullStepAcceleration - this.currentAccel) / timeStep > jerk) {
            if (fullStepAcceleration > currentAccel)
                fullStepAcceleration = currentAccel + jerk * timeStep;
            else
                fullStepAcceleration = currentAccel - jerk * timeStep;
        }

        var newSpeed = currentSpeed + directionSign * fullStepAcceleration * timeStep;
        var newAccel = fullStepAcceleration;

        var timeDelta = timeStep;

        // if the speed change sign or is very low we integrate only the step at which the speed is zero
        if (currentSpeed != 0.0 && (Math.signum(newSpeed) != Math.signum(currentSpeed) || Math.abs(newSpeed) < 1E-10)) {
            timeDelta = -currentSpeed / fullStepAcceleration;
            newSpeed = 0.;
        }

        // TODO the integration of the rolling resistance
        var newPositionDelta = computePositionDelta(currentSpeed, fullStepAcceleration, timeDelta, directionSign);

        if (newPositionDelta <= maxDistance)
            return new PositionUpdate(timeDelta, newPositionDelta, newSpeed, newAccel);

        timeDelta = computeTimeDelta(currentSpeed, fullStepAcceleration, maxDistance);
        assert timeDelta < timeStep && timeDelta >= 0;
        newSpeed = currentSpeed + fullStepAcceleration * timeDelta;
        newAccel = fullStepAcceleration;
        return new PositionUpdate(timeDelta, maxDistance, newSpeed, newAccel);
    }
}