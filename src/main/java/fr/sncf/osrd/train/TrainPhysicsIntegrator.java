package fr.sncf.osrd.train;


import static java.lang.Math.abs;
import static fr.sncf.osrd.train.RollingStock.GammaType.CONST;
import static java.lang.Math.min;

import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.speedcontroller.SpeedDirective;
import fr.sncf.osrd.utils.Constants;
import java.util.Set;

/**
 * An utility class to help simulate the train, using numerical integration.
 * It's used when simulating the train, and it is passed to speed controllers so they can take decisions
 * about what action to make. Once speed controllers took a decision, this same class is used to compute
 * the next position and speed of the train.
 */
public class TrainPhysicsIntegrator {
    private final double timeStep;
    private final double currentSpeed;
    private final double weightForce;
    private final double rollingResistance;
    private final double inertia;

    /**
     * The constructor of the class
     * @param timeStep the timeStep of the simulation
     * @param rollingStock the specs of the train
     * @param currentSpeed the current speed of the train
     * @param meanTrainGrade the maximum slope under the train
     */
    public TrainPhysicsIntegrator(
            double timeStep,
            RollingStock rollingStock,
            double currentSpeed,
            double meanTrainGrade
    ) {
        assert timeStep > 0;
        // get an angle from a meter per km elevation difference
        // the curve's radius is taken into account in meanTrainGrade
        var angle = Math.atan(meanTrainGrade / 1000.0);  // from m/km to m/m
        var weightForce = - rollingStock.mass * Constants.GRAVITY * Math.sin(angle);

        this.timeStep = timeStep;
        this.currentSpeed = currentSpeed;
        this.weightForce = weightForce;
        this.rollingResistance = rollingStock.rollingResistance(currentSpeed);
        assert rollingResistance >= 0.;
        this.inertia = rollingStock.mass * rollingStock.inertiaCoefficient;
    }

    /**
     * (Internal) Computes the acceleration of the train,
     * as the sum of forces acting on the train divided by its inertia
     * @param action the action of the train
     * @return the acceleration of the train
     */
    public double computeAcceleration(Action action) {

        double actionTractionForce = action.tractionForce();
        double actionBrakingForce = action.brakingForce();
        assert actionBrakingForce >= 0.;

        // the sum of forces that always go the direction opposite to the train's movement
        double oppositeForce = rollingResistance + actionBrakingForce;

        // as the oppositeForces is a reaction force, it needs to be adjusted to be opposed to the other forces
        double effectiveOppositeForces;
        if (currentSpeed == 0.0) {
            var totalOtherForce = actionTractionForce + weightForce;
            // if the train is stopped and the rolling resistance is greater in amplitude than the other forces,
            // the train won't move
            if (abs(totalOtherForce) < oppositeForce)
                return 0.0;
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
        return (actionTractionForce + weightForce + effectiveOppositeForces) / inertia;
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
        // a<0 dec force<0
        // a>0 acc force>0
        // normally the train speed should be positive
        assert currentSpeed >= 0;

        // if the train is supposed to coast, make sure there's not a more restraining speedController active
        if (speedDirective.isCoasting && currentSpeed <= speedDirective.allowedSpeed) {
            return Action.coast();
        }

        // the total force the train needs to reach target speed
        var targetForce = directionSign * (speedDirective.allowedSpeed - currentSpeed) / timeStep * inertia;
        // limited the possible acceleration for reasons of travel comfort
        if (targetForce > rollingStock.comfortAcceleration * inertia)
            targetForce = rollingStock.comfortAcceleration * inertia;

        // targetForce = actionForce - mass * g * slope - Ra
        // targetForce = actionForce + weightForce + oppositeForces
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
        if (actionForce < maxBrakingForce) {
            actionForce = maxBrakingForce;
            if (rollingStock.gammaType == CONST)
                actionForce -= rollingResistance + weightForce;
        }
        return Action.brake(Math.abs(actionForce));
    }

    private static double computePositionDelta(double currentSpeed, double acceleration,
                                               double timeStep, double directionSign) {
        // dx = currentSpeed * dt + 1/2 * acceleration * dt * dt
        var positionDelta = currentSpeed * timeStep + 0.5 * acceleration * timeStep * timeStep;
        return directionSign * positionDelta;
    }

    private static double computeTimeDelta(double currentSpeed, double acceleration, double positionDelta) {
        // Solve: acceleration / 2 * t^2 + currentSpeed * t - positionDelta = 0
        if (abs(acceleration) < 0.00001)
            return positionDelta / currentSpeed;
        var numerator = -currentSpeed + Math.sqrt(currentSpeed * currentSpeed + 2 * positionDelta * acceleration);
        return numerator / acceleration;
    }


    /**
     * Compute a train's integration step given an action
     * @param action the action made by the driver
     * @param maxDistance the maximum distance the train can go
     * @return the new speed of the train
     */
    public IntegrationStep stepFromAction(Action action, double maxDistance, double directionSign) {
        return stepFromAcceleration(
                computeAcceleration(action),
                action.tractionForce(),
                maxDistance,
                directionSign
        );
    }


    /**
     * Compute a train's integration step given an acceleration
     * @param acceleration the acceleration of the train during that step
     * @param tractionForce the traction force of the train during that step
     * @param maxDistance the maximum distance the train can go
     * @param directionSign +1 if forward circulation, -1 if backwards
     * @return the new speed of the train
     */
    public IntegrationStep stepFromAcceleration(double acceleration, double tractionForce,
                                                              double maxDistance, double directionSign) {

        var newSpeed = currentSpeed + directionSign * acceleration * timeStep;
        var timeDelta = timeStep;

        // if the speed change sign or is very low we integrate only the step at which the speed is zero
        if (currentSpeed != 0.0 && (Math.signum(newSpeed) != Math.signum(currentSpeed) || abs(newSpeed) < 1E-10)) {
            timeDelta = -currentSpeed / (directionSign * acceleration);
            newSpeed = 0.;
        }

        var newPositionDelta = computePositionDelta(currentSpeed, acceleration, timeDelta, directionSign);

        if (newPositionDelta <= maxDistance)
            return new IntegrationStep(timeDelta, newPositionDelta, newSpeed, acceleration, tractionForce);

        timeDelta = computeTimeDelta(currentSpeed, acceleration, maxDistance);
        assert timeDelta < timeStep && timeDelta >= 0;
        newSpeed = currentSpeed + acceleration * timeDelta;
        return  new IntegrationStep(timeDelta, maxDistance, newSpeed, acceleration, tractionForce);
    }

    // region NEXT_STEP_HELPERS

    /** Computes the next step of the integration method, based on location, speed, and a directive. */
    public static IntegrationStep nextStepFromDirective(TrainPositionTracker currentLocation,
                                                        double currentSpeed,
                                                        SpeedDirective directive,
                                                        RollingStock rollingStock,
                                                        double timeStep,
                                                        double distanceLeft,
                                                        int directionSign) {

        var integrator = new TrainPhysicsIntegrator(
                timeStep,
                rollingStock,
                currentSpeed,
                currentLocation.meanTrainGrade());
        var action = integrator.actionToTargetSpeed(directive, rollingStock, directionSign);
        assert action != null;
        assert action.type != Action.ActionType.EMERGENCY_BRAKING;
        return integrator.stepFromAction(
                action,
                distanceLeft,
                directionSign
        );
    }

    /** Computes the next step of the integration method, based on location, speed, and a specified action. */
    public static IntegrationStep nextStepFromAction(TrainPositionTracker currentLocation,
                                                            double currentSpeed,
                                                            Action action,
                                                            RollingStock rollingStock,
                                                            double timeStep,
                                                            double end,
                                                            int directionSign) {

        var integrator = new TrainPhysicsIntegrator(
                timeStep,
                rollingStock,
                currentSpeed,
                currentLocation.meanTrainGrade());
        var distanceLeft = end - currentLocation.getPathPosition();
        assert action != null;
        assert action.type != Action.ActionType.EMERGENCY_BRAKING;
        return integrator.stepFromAction(
                action,
                distanceLeft,
                directionSign
        );
    }

    /** Computes the next step of the integration method, based on location, speed, and a set of controllers. */
    public static IntegrationStep nextStepFromControllers(TrainPositionTracker currentLocation,
                                                                 double currentSpeed,
                                                                 Set<SpeedController> controllers,
                                                                 RollingStock rollingStock,
                                                                 double timeStep,
                                                                 double end,
                                                                 int stopIndex,
                                                                 int directionSign) {
        var integrator = new TrainPhysicsIntegrator(
                timeStep,
                rollingStock,
                currentSpeed,
                currentLocation.meanTrainGrade());
        var nextPosition = currentLocation.getPathPosition() + currentSpeed * timeStep;
        final var finalNextPosition = min(nextPosition, end);
        var directive = SpeedController.getDirective(controllers, finalNextPosition, stopIndex);
        var action = integrator.actionToTargetSpeed(directive, rollingStock);
        var distanceLeft = end - finalNextPosition;
        assert action != null;
        assert action.type != Action.ActionType.EMERGENCY_BRAKING;
        return integrator.stepFromAction(
                action,
                distanceLeft,
                directionSign
        );
    }

    // endregion
}
