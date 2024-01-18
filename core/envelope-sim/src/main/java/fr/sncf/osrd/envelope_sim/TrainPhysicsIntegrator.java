package fr.sncf.osrd.envelope_sim;

import com.google.common.collect.RangeMap;

/**
 * An utility class to help simulate the train, using numerical integration.
 * It's used when simulating the train, and it is passed to speed controllers so they can take decisions
 * about what action to make. Once speed controllers took a decision, this same class is used to compute
 * the next position and speed of the train.
 */
public final class TrainPhysicsIntegrator {
    // A position delta lower than this value will be considered zero
    // Going back and forth with Distance and double (meters) often causes 1e-3 errors,
    // we need the tolerance to be higher than this
    private static final double POSITION_EPSILON = 1E-2;
    // A speed lower than this value will be considered zero
    private static final double SPEED_EPSILON = 1E-5;
    // An acceleration lower than this value will be considered zero
    private static final double ACCELERATION_EPSILON = 1E-5;
    private static final double TIME_EPSILON = 1E-5;

    private final PhysicsRollingStock rollingStock;
    private final PhysicsPath path;
    private final Action action;
    private final double directionSign;

    private final RangeMap<Double, PhysicsRollingStock.TractiveEffortPoint[]> tractiveEffortCurveMap;

    private TrainPhysicsIntegrator(
            PhysicsRollingStock rollingStock,
            PhysicsPath path,
            Action action,
            double directionSign,
            RangeMap<Double, PhysicsRollingStock.TractiveEffortPoint[]> tractiveEffortCurveMap
    ) {
        this.rollingStock = rollingStock;
        this.path = path;
        this.action = action;
        this.directionSign = directionSign;
        this.tractiveEffortCurveMap = tractiveEffortCurveMap;
    }

    /** Simulates train movement */
    public static IntegrationStep step(
            EnvelopeSimContext context,
            double initialLocation,
            double initialSpeed,
            Action action,
            double directionSign
    ) {
        var integrator = new TrainPhysicsIntegrator(context.rollingStock, context.path, action, directionSign,
                context.tractiveEffortCurveMap);
        return integrator.step(context.timeStep, initialLocation, initialSpeed, directionSign);
    }

    /** Simulates train movement */
    private IntegrationStep step(
            double timeStep,
            double initialLocation,
            double initialSpeed,
            double directionSign
    ) {
        var halfStep = timeStep / 2;
        var step1 = step(halfStep, initialLocation, initialSpeed);
        var step2 = step(halfStep, initialLocation + step1.positionDelta, step1.endSpeed);
        var step3 = step(timeStep, initialLocation + step2.positionDelta, step2.endSpeed);
        var step4 = step(timeStep, initialLocation + step3.positionDelta, step3.endSpeed);

        var meanAcceleration = (
                step1.acceleration
                + 2 * step2.acceleration
                + 2 * step3.acceleration
                + step4.acceleration
        ) / 6.;
        return newtonStep(timeStep, initialSpeed, meanAcceleration, directionSign);
    }


    private IntegrationStep step(double timeStep, double position, double speed) {
        double tractionForce = 0;
        double brakingForce = 0;
        var tractiveEffortCurve = tractiveEffortCurveMap.get(Math.min(Math.max(0, position), path.getLength()));
        assert tractiveEffortCurve != null;
        double maxTractionForce = PhysicsRollingStock.getMaxEffort(speed, tractiveEffortCurve);
        double rollingResistance = rollingStock.getRollingResistance(speed);
        double weightForce = getWeightForce(rollingStock, path, position);

        if (action == Action.ACCELERATE)
            tractionForce = maxTractionForce;

        if (action == Action.BRAKE)
            brakingForce = rollingStock.getMaxBrakingForce(speed);

        if (action == Action.MAINTAIN) {
            tractionForce = rollingResistance - weightForce;
            if (tractionForce <= maxTractionForce)
                return newtonStep(timeStep, speed, 0, directionSign);
            else tractionForce = maxTractionForce;
        }

        double acceleration = computeAcceleration(rollingStock, rollingResistance,
                weightForce, speed, tractionForce, brakingForce, directionSign);
        return newtonStep(timeStep, speed, acceleration, directionSign);
    }

    /** Compute the weight force of a rolling stock at a given position on a given path */
    public static double getWeightForce(PhysicsRollingStock rollingStock, PhysicsPath path, double headPosition) {
        var tailPosition = Math.min(Math.max(0, headPosition - rollingStock.getLength()), path.getLength());
        headPosition = Math.min(Math.max(0, headPosition), path.getLength());
        var averageGrade = path.getAverageGrade(tailPosition, headPosition);
        // get an angle from a meter per km elevation difference
        // the curve's radius is taken into account in meanTrainGrade
        var angle = Math.atan(averageGrade / 1000.0);  // from m/km to m/m
        return -rollingStock.getMass() * 9.81 * Math.sin(angle);
    }

    /** Compute the acceleration given a rolling stock, different forces, a speed, and a direction */
    public static double computeAcceleration(
            PhysicsRollingStock rollingStock,
            double rollingResistance,
            double weightForce,
            double currentSpeed,
            double tractionForce,
            double brakingForce,
            double directionSign) {

        assert brakingForce >= 0.;
        assert tractionForce >= 0.;

        if (brakingForce > 0 && rollingStock.getGammaType() == PhysicsRollingStock.GammaType.CONST)
            return rollingStock.getDeceleration();

        // the sum of forces that always go the direction opposite to the train's movement
        double oppositeForce = rollingResistance + brakingForce;
        if (currentSpeed == 0 && directionSign > 0) {
            // If we are stopped and if the forces are not enough to compensate the opposite force,
            // the rolling resistance and braking force don't apply and the speed stays at 0
            // Unless we integrate backwards, then we need the speed to increase
            var totalOtherForce = tractionForce + weightForce;
            if (Math.abs(totalOtherForce) < oppositeForce)
                return 0.0;
        }

        // as the oppositeForces are reaction forces, they need to be adjusted to be opposed to the other forces
        if (currentSpeed >= 0.0) {
            // if the train is moving forward or still, the opposite forces are negative
            return (tractionForce + weightForce - oppositeForce) / rollingStock.getInertia();
        } else {
            // if the train is moving backwards, the opposite forces are positive
            return (tractionForce + weightForce + oppositeForce) / rollingStock.getInertia();
        }
    }

    /** Integrate the Newton movement equations*/
    public static IntegrationStep newtonStep(
            double timeStep,
            double currentSpeed,
            double acceleration,
            double directionSign
    ) {
        var signedTimeStep = Math.copySign(timeStep, directionSign);
        var newSpeed = currentSpeed + acceleration * signedTimeStep;
        if (Math.abs(newSpeed) < SPEED_EPSILON)
            newSpeed = 0;

        // dx = currentSpeed * dt + 1/2 * acceleration * dt * dt
        var positionDelta = currentSpeed * signedTimeStep + 0.5 * acceleration * signedTimeStep * signedTimeStep;

        if (Math.abs(positionDelta) < POSITION_EPSILON)
            positionDelta = 0;
        return IntegrationStep.fromNaiveStep(
                timeStep, positionDelta,
                currentSpeed, newSpeed,
                acceleration, directionSign
        );
    }

    /** Returns true if the positions' difference is lower than epsilon */
    public static boolean arePositionsEqual(double a, double b) {
        return areDoublesEqual(a, b, POSITION_EPSILON);
    }

    /** Returns true if the speeds' difference is lower than an epsilon */
    public static boolean areSpeedsEqual(double a, double b) {
        return areDoublesEqual(a, b, SPEED_EPSILON);
    }

    /** Returns true if the accelerations' difference is lower than an epsilon */
    public static boolean areAccelerationsEqual(double a, double b) {
        return areDoublesEqual(a, b, ACCELERATION_EPSILON);
    }

    /** Returns true if the times' difference is lower than an epsilon */
    public static boolean areTimesEqual(double a, double b) {
        return areDoublesEqual(a, b, TIME_EPSILON);
    }

    private static boolean areDoublesEqual(double a, double b, double delta) {
        return Math.abs(a - b) < delta;
    }
}
