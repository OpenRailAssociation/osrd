package fr.sncf.osrd.train;


import static fr.sncf.osrd.train.RollingStock.GammaType.CONST;
import static java.lang.Math.*;

import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.speedcontroller.SpeedDirective;
import fr.sncf.osrd.utils.Constants;
import java.util.Set;
import java.util.function.Function;

/**
 * An utility class to help simulate the train, using numerical integration.
 * It's used when simulating the train, and it is passed to speed controllers so they can take decisions
 * about what action to make. Once speed controllers took a decision, this same class is used to compute
 * the next position and speed of the train.
 */
public class TrainPhysicsIntegrator {
    private final double timeStep;
    private final TrainPositionTracker currentLocation;
    private final double currentSpeed;
    private final double weightForce;
    private final RollingStock rollingStock;
    private final double rollingResistance;
    private final double inertia;

    /**
     * The constructor of the class
     * @param timeStep the timeStep of the simulation
     * @param rollingStock the specs of the train
     * @param currentLocation the current location of the train
     * @param currentSpeed the current speed of the train
     */
    public TrainPhysicsIntegrator(
            double timeStep,
            RollingStock rollingStock,
            TrainPositionTracker currentLocation,
            double currentSpeed
    ) {
        assert timeStep > 0;
        // get an angle from a meter per km elevation difference
        // the curve's radius is taken into account in meanTrainGrade
        var angle = Math.atan(currentLocation.meanTrainGrade() / 1000.0);  // from m/km to m/m
        var weightForce = - rollingStock.mass * Constants.GRAVITY * Math.sin(angle);

        this.timeStep = timeStep;
        this.currentLocation = currentLocation;
        this.currentSpeed = currentSpeed;
        this.weightForce = weightForce;
        this.rollingStock = rollingStock;
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

    /**
     * Computes the action of the train, given a set of speedControllers
     * @param controllers the set of speedControllers we're gonna get the action from
     * @param end end position of the route
     * @param stopIndex number of stops in the route
     * @return the action of the train
     */
    public Action computeActionFromControllers(Set<SpeedController> controllers, double end, int stopIndex) {
        var currentPosition = currentLocation.getPathPosition();
        final var finalNextPosition = min(currentPosition, end);
        var directive = SpeedController.getDirective(controllers, finalNextPosition, stopIndex);
        return actionToTargetSpeed(directive, rollingStock);
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
        if (abs(acceleration) < 1E-5) {
            if (abs(currentSpeed) < 1E-5)
                return 0.0;
            return positionDelta / currentSpeed;
        }
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
                false,
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
    public IntegrationStep stepFromAcceleration(double acceleration, double tractionForce, double maxDistance,
                                                boolean isRKStep, double directionSign) {

        var newSpeed = currentSpeed + directionSign * acceleration * timeStep;
        var timeDelta = timeStep;

        // if the speed change sign or is very low we integrate only the step at which the speed is zero
        if ((!isRKStep && currentSpeed != 0.0 && (Math.signum(newSpeed) != Math.signum(currentSpeed) || abs(newSpeed) < 1E-5))
        || (isRKStep && (newSpeed < 0.0 || abs(newSpeed) < 1E-5))) {
            timeDelta = -currentSpeed / (directionSign * acceleration);
            newSpeed = 0.;
        }

        var newPositionDelta = computePositionDelta(currentSpeed, acceleration, timeDelta, directionSign);

        if (newPositionDelta <= maxDistance)
            return new IntegrationStep(timeDelta, newPositionDelta, newSpeed, acceleration, tractionForce);

        timeDelta = computeTimeDelta(currentSpeed, acceleration, maxDistance);
        assert timeDelta < timeStep && timeDelta >= 0;
        newSpeed = currentSpeed + directionSign * acceleration * timeDelta;
        return new IntegrationStep(timeDelta, maxDistance, newSpeed, acceleration, tractionForce);
    }

    public static IntegrationStep nextStep(TrainPositionTracker initialLocation,
                                           double initialSpeed,
                                           RollingStock rollingStock,
                                           double timeStep,
                                           double end,
                                           int directionSign,
                                           Function<TrainPhysicsIntegrator, Action> makeAction) {
        var halfIntegrator = new TrainPhysicsIntegrator(
                timeStep / 2,
                rollingStock,
                initialLocation,
                initialSpeed
        );
        var fullIntegrator = new TrainPhysicsIntegrator(
                timeStep,
                rollingStock,
                initialLocation,
                initialSpeed
        );
        var maxDistance = end - initialLocation.getPathPosition();

        var step1 = makeRKStep(halfIntegrator, 0, initialSpeed,
                makeAction, directionSign, maxDistance);

        var step2 = makeRKStep(halfIntegrator,  step1.positionDelta, step1.finalSpeed,
                makeAction, directionSign, maxDistance);

        var step3 = makeRKStep(fullIntegrator, step2.positionDelta, step2.finalSpeed,
                makeAction, directionSign, maxDistance);

        var step4 = makeRKStep(fullIntegrator, step3.positionDelta, step3.finalSpeed,
                makeAction, directionSign, maxDistance);


        var meanAcceleration = (1. / 6.) * (step1.acceleration + 2 * step2.acceleration
                + 2 * step3.acceleration + step4.acceleration);
        var meanTractionForce = (1. / 6.) * (step1.tractionForce + 2 * step2.tractionForce
                + 2 * step3.tractionForce + step4.tractionForce);

        var integrator = new TrainPhysicsIntegrator(
                timeStep,
                rollingStock,
                initialLocation,
                initialSpeed
        );
        return integrator.stepFromAcceleration(meanAcceleration, meanTractionForce, maxDistance, false, directionSign);
    }

    private static IntegrationStep makeRKStep(TrainPhysicsIntegrator initialIntegrator,
                                              double offset,
                                              double intermediateSpeed,
                                              Function<TrainPhysicsIntegrator, Action> makeAction,
                                              int directionSign,
                                              double maxDistance) {
        var initialLocation = initialIntegrator.currentLocation;
        var rollingStock = initialIntegrator.rollingStock;
        var timeStep = initialIntegrator.timeStep;

        var intermediateLocation = initialLocation.clone();
        intermediateLocation.updatePosition(rollingStock.length, offset);
        var integrator = new TrainPhysicsIntegrator(
                timeStep,
                rollingStock,
                intermediateLocation,
                intermediateSpeed
        );
        var action = makeAction.apply(integrator);
        // the acceleration and traction force evaluated at this intermediate runge-kutta step
        var acceleration = integrator.computeAcceleration(action);
        var tractionForce = action.tractionForce();

        return initialIntegrator.stepFromAcceleration(acceleration, tractionForce, maxDistance, true, directionSign);
    }
}
