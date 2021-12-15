package fr.sncf.osrd.standalone_sim;


import static java.lang.Math.*;

import fr.sncf.osrd.train.RollingStock;

/**
 * An utility class to help simulate the train, using numerical integration.
 * It's used when simulating the train, and it is passed to speed controllers so they can take decisions
 * about what action to make. Once speed controllers took a decision, this same class is used to compute
 * the next position and speed of the train.
 */
public final class TrainPhysicsIntegrator {
    // an acceleration lower than this value will be considered zero
    public static final double ACCELERATION_EPSILON = 1E-5;
    // a speed lower than this value will be considered zero
    public static final double SPEED_EPSILON = 1E-5;
    // a position delta lower than this value will be considered zero
    public static final double POSITION_EPSILON = 1E-6;

    public static IntegrationStep step(
            RollingStock rollingStock,
            double timeStep,
            double initialLocation,
            double initialSpeed,
            Action action,
            double directionSign
    ) {
        var halfStep = timeStep / 2;
        var step1 = RKStep(rollingStock, halfStep, initialLocation, initialSpeed, action, directionSign);
        var step2 = RKStep(rollingStock, halfStep, initialLocation + step1.positionDelta, step1.speed, action, directionSign);
        var step3 = RKStep(rollingStock, timeStep, initialLocation + step2.positionDelta, step2.speed, action, directionSign);
        var step4 = RKStep(rollingStock, timeStep, initialLocation + step3.positionDelta, step3.speed, action, directionSign);

        var meanAcceleration = (1. / 6.) * (step1.acceleration + 2 * step2.acceleration
                + 2 * step3.acceleration + step4.acceleration);

        return newtonStep(timeStep, initialSpeed, meanAcceleration, directionSign);
    }

    private static IntegrationStep RKStep(
            RollingStock rollingStock,
            double timeStep,
            double location,
            double speed,
            Action action,
            double directionSign
    ) {
        var rollingResistance = rollingStock.rollingResistance(speed);
        var weightForce = getWeightForce(rollingStock, location);
        var tractionForce = getTraction(rollingStock, action, speed);
        var acceleration = computeAcceleration(rollingStock, rollingResistance, weightForce, speed, tractionForce);
        return newtonStep(timeStep, speed, acceleration, directionSign);
    }

    private static double getTraction(RollingStock rollingStock, Action action, double speed) {
        switch (action) {
            case ACCELERATE:
                return rollingStock.getMaxEffort(speed);
            case BRAKE:
                return -rollingStock.gamma * rollingStock.inertia;
        }
        throw new RuntimeException("unreachable");
    }

    private static double getWeightForce(RollingStock rollingStock, double location) {
        return 42;
    }

    public static double computeAcceleration(
            RollingStock rollingStock,
            double rollingResistance,
            double weightForce,
            double currentSpeed,
            double tractionForce
    ) {
        double brakingForce = 0;
        if (tractionForce < 0) {
            brakingForce = -tractionForce;
            tractionForce = 0;
        }

        // the sum of forces that always go the direction opposite to the train's movement
        double oppositeForce = rollingResistance + brakingForce;

        // as the oppositeForces is a reaction force, it needs to be adjusted to be opposed to the other forces
        double effectiveOppositeForces;
        if (currentSpeed == 0.0) {
            var totalOtherForce = tractionForce + weightForce;
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
        return (tractionForce + weightForce + effectiveOppositeForces) / rollingStock.inertia;
    }

    private static double computePositionDelta(
            double currentSpeed, double acceleration,
            double timeStep, double directionSign
    ) {
        // dx = currentSpeed * dt + 1/2 * acceleration * dt * dt
        var positionDelta = currentSpeed * timeStep + 0.5 * acceleration * timeStep * timeStep;
        var delta = directionSign * positionDelta;
        if (abs(delta) < POSITION_EPSILON)
            delta = 0;
        return delta;
    }

    /** Stop the step if the speed changes sign, unless we start at 0 */
    private static boolean shouldStopStepAtZeroSpeed(double currentSpeed, double newSpeed) {
        var isNewSpeedZero = abs(newSpeed) < SPEED_EPSILON;
        var hasChangedSign = Math.signum(newSpeed) != Math.signum(currentSpeed);
        return currentSpeed != 0.0 && (isNewSpeedZero || hasChangedSign);
    }

    public static IntegrationStep newtonStep(
            double timeStep,
            double currentSpeed,
            double acceleration,
            double directionSign
    ) {
        var newSpeed = currentSpeed + directionSign * acceleration * timeStep;
        var timeDelta = timeStep;

        if (shouldStopStepAtZeroSpeed(currentSpeed, newSpeed)) {
            if (abs(acceleration) < ACCELERATION_EPSILON)
                timeDelta = 0;
            else
                timeDelta = -currentSpeed / (directionSign * acceleration);

            newSpeed = 0.;
        }

        var newPositionDelta = computePositionDelta(currentSpeed, acceleration, timeDelta, directionSign);
        return new IntegrationStep(timeDelta, newPositionDelta, newSpeed, acceleration);
    }
}
