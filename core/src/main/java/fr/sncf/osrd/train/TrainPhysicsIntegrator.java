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
    private final double currentSpeed;
    private final double weightForce;
    private final RollingStock rollingStock;
    private final double rollingResistance;
    private final double inertia;
    public final TrainPositionTracker currentLocation;
    // an acceleration lower than this value will be considered zero
    public static final double limitAcceleration = 1E-5;
    // a speed lower than this value will be considered zero
    public static final double limitSpeed = 1E-5;
    // a position delta lower than this value will be considered zero
    public static final double limitPositionDelta = 1E-6;

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
        this.timeStep = timeStep;
        this.currentLocation = currentLocation;
        this.currentSpeed = currentSpeed;
        // get an angle from a meter per km elevation difference
        // the curve's radius is taken into account in meanTrainGrade
        var angle = Math.atan(currentLocation.meanTrainGrade() / 1000.0);  // from m/km to m/m
        this.weightForce = - rollingStock.mass * Constants.GRAVITY * Math.sin(angle);
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
    public double computeAcceleration(Action action, double directionSign) {

        double actionTractionForce = action.tractionForce();
        double actionBrakingForce = action.brakingForce();
        assert actionBrakingForce >= 0.;

        // the sum of forces that always go the direction opposite to the train's movement
        double oppositeForce = rollingResistance + actionBrakingForce;
        // as the oppositeForces is a reaction force, it needs to be adjusted to be opposed to the other forces
        if (currentSpeed == 0 && directionSign > 0) {
            var totalOtherForce = actionTractionForce + weightForce;
            if (abs(totalOtherForce) < oppositeForce)
                return 0.0;
        }
        if (currentSpeed >= 0.0) {
            // if the train is moving forward or still, the opposite forces are negative
            return (actionTractionForce + weightForce - oppositeForce) / inertia;
        } else {
            // if the train is moving backwards, the opposite forces are positive
            return (actionTractionForce + weightForce + oppositeForce) / inertia;
        }

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

        // if the train is supposed to coast, make sure there's not a more restraining speedController active
        if (speedDirective.isCoasting && currentSpeed <= speedDirective.allowedSpeed && currentSpeed != 0) {
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
        var positionDelta = directionSign * currentSpeed * timeStep + 0.5 * acceleration * timeStep * timeStep;
        if (abs(positionDelta) < limitPositionDelta)
            positionDelta = 0;
        return positionDelta;
    }

    private static double computeTimeDelta(double currentSpeed, double acceleration, double positionDelta,
                                           double directionSign) {
        // Solve: (acceleration / 2) * t^2 + currentSpeed * t = directionSing * positionDelta
        if (abs(acceleration) < limitAcceleration) {
            if (abs(currentSpeed) < limitSpeed)
                return 0.0;
            return directionSign * positionDelta / currentSpeed;
        }
        var numerator = -currentSpeed
                + Math.sqrt(currentSpeed * currentSpeed + 2 * positionDelta * acceleration * directionSign);
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
                computeAcceleration(action, directionSign),
                action.tractionForce(),
                maxDistance,
                directionSign
        );
    }


    /** Stop the step if the speed changes speed, unless we start at 0 */
    private boolean shouldStopStepAtZeroSpeed(double newSpeed) {
        var isNewSpeedZero = abs(newSpeed) < limitSpeed;
        var hasChangedSign = Math.signum(newSpeed) != Math.signum(currentSpeed);
        return currentSpeed != 0.0 && (isNewSpeedZero || hasChangedSign);
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
                                                double directionSign) {

        var newSpeed = currentSpeed + directionSign * acceleration * timeStep;
        var timeDelta = timeStep;

        if (shouldStopStepAtZeroSpeed(newSpeed)) {
            if (abs(acceleration) < limitAcceleration)
                timeDelta = 0;
            else
                timeDelta = -currentSpeed / (directionSign * acceleration);

            newSpeed = 0.;
        }

        var newPositionDelta = computePositionDelta(currentSpeed, acceleration, timeDelta, directionSign);

        if (newPositionDelta <= maxDistance && currentLocation.getPathPosition() + newPositionDelta >= 0)
            return new IntegrationStep(timeDelta, newPositionDelta, newSpeed, acceleration, tractionForce);

        if (newPositionDelta > 0)
            newPositionDelta = maxDistance;
        else
            newPositionDelta = -currentLocation.getPathPosition();

        timeDelta = computeTimeDelta(currentSpeed, acceleration, newPositionDelta, directionSign);
        assert timeDelta < timeStep && timeDelta >= 0;
        newSpeed = currentSpeed + directionSign * acceleration * timeDelta;
        return new IntegrationStep(timeDelta, newPositionDelta, newSpeed, acceleration, tractionForce);
    }

    /**
     * Compute the next integration step with runge-kutta 4 method
     * @param initialLocation the location at the beginning of the step
     * @param initialSpeed the speed at the beginning of the step
     * @param rollingStock the rolling stock used for the step
     * @param timeStep the time step used for the step
     * @param end the end of the train's path
     * @param directionSign +1 if forward circulation, -1 if backwards
     * @param makeAction a function that returns an action given an integrator
     * @return the new speed of the train
     */
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
        return integrator.stepFromAcceleration(meanAcceleration, meanTractionForce, maxDistance, directionSign);
    }

    /**
     * Computes next runge-kutta intermediate step.
     * This step is then used to memorize the acceleration and calculate the runge-kutta 4 mean acceleration.
     * @param initialIntegrator the integrator with the initial speed and initial position of the step
     * @param positionDelta the position delta of that runge-kutta intermediate step
     * @param intermediateSpeed the speed of that runge-kutta intermediate step
     * @param makeAction the action method
     * @param directionSign +1 if forward circulation, -1 if backwards
     * @param maxDistance the maximum distance the train can travel
     * @return the next runge-kutta intermediate step
     */
    private static IntegrationStep makeRKStep(TrainPhysicsIntegrator initialIntegrator,
                                              double positionDelta,
                                              double intermediateSpeed,
                                              Function<TrainPhysicsIntegrator, Action> makeAction,
                                              int directionSign,
                                              double maxDistance) {
        var initialLocation = initialIntegrator.currentLocation;
        var rollingStock = initialIntegrator.rollingStock;
        var timeStep = initialIntegrator.timeStep;

        var intermediateLocation = initialLocation.clone();
        intermediateLocation.updatePosition(rollingStock.length, positionDelta);
        var integrator = new TrainPhysicsIntegrator(
                timeStep,
                rollingStock,
                intermediateLocation,
                intermediateSpeed
        );
        var action = makeAction.apply(integrator);
        // the acceleration and traction force evaluated at this intermediate runge-kutta step
        var acceleration = integrator.computeAcceleration(action, directionSign);
        var tractionForce = action.tractionForce();

        return initialIntegrator.stepFromAcceleration(acceleration, tractionForce, maxDistance, directionSign);
    }
}