package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope_sim.PhysicsRollingStock.getGradientAcceleration;
import static fr.sncf.osrd.envelope_sim.PhysicsRollingStock.getMaxEffort;
import static fr.sncf.osrd.utils.UnitEqualityKt.POSITION_EPSILON;
import static fr.sncf.osrd.utils.UnitEqualityKt.SPEED_EPSILON;

import com.google.common.collect.RangeMap;
import fr.sncf.osrd.envelope_sim.etcs.BrakingType;
import fr.sncf.osrd.path.interfaces.PhysicsPath;

/**
 * A utility class to help simulate the train, using numerical integration. It's used when
 * simulating the train, and it is passed to speed controllers so they can take decisions about what
 * action to make. Once speed controllers took a decision, this same class is used to compute the
 * next position and speed of the train.
 */
public final class TrainPhysicsIntegrator {
    // Gravity acceleration, in m/s²
    public static final double GRAVITY_ACCELERATION = 9.81;

    private final PhysicsRollingStock rollingStock;
    private final PhysicsPath path;
    private final Action action;
    private final double directionSign;

    private final RangeMap<Double, PhysicsRollingStock.TractiveEffortPoint[]> tractiveEffortCurveMap;
    private final BrakingType brakingType;

    private TrainPhysicsIntegrator(
            PhysicsRollingStock rollingStock,
            PhysicsPath path,
            Action action,
            double directionSign,
            RangeMap<Double, PhysicsRollingStock.TractiveEffortPoint[]> tractiveEffortCurveMap,
            BrakingType brakingType) {
        this.rollingStock = rollingStock;
        this.path = path;
        this.action = action;
        this.directionSign = directionSign;
        this.tractiveEffortCurveMap = tractiveEffortCurveMap;
        this.brakingType = brakingType;
    }

    /** Simulates train movement */
    public static IntegrationStep step(
            EnvelopeSimContext context,
            double initialLocation,
            double initialSpeed,
            Action action,
            double directionSign) {
        return step(context, initialLocation, initialSpeed, action, directionSign, BrakingType.CONSTANT);
    }

    /** Simulates train movement */
    public static IntegrationStep step(
            EnvelopeSimContext context,
            double initialLocation,
            double initialSpeed,
            Action action,
            double directionSign,
            BrakingType brakingType) {
        var integrator = new TrainPhysicsIntegrator(
                context.rollingStock, context.path, action, directionSign, context.tractiveEffortCurveMap, brakingType);
        return integrator.step(context.timeStep, initialLocation, initialSpeed, directionSign);
    }

    /** Simulates train movement */
    private IntegrationStep step(double timeStep, double initialLocation, double initialSpeed, double directionSign) {
        var halfStep = timeStep / 2;
        var step1 = step(halfStep, initialLocation, initialSpeed);
        var step2 = step(halfStep, initialLocation + step1.positionDelta, step1.endSpeed);
        var step3 = step(timeStep, initialLocation + step2.positionDelta, step2.endSpeed);
        var step4 = step(timeStep, initialLocation + step3.positionDelta, step3.endSpeed);

        var meanAcceleration =
                (step1.acceleration + 2 * step2.acceleration + 2 * step3.acceleration + step4.acceleration) / 6.;
        return newtonStep(timeStep, initialSpeed, meanAcceleration, directionSign);
    }

    private IntegrationStep step(double timeStep, double position, double speed) {
        if (action == Action.BRAKE) return newtonStep(timeStep, speed, getDeceleration(speed, position), directionSign);

        double tractionForce = 0;
        var tractiveEffortCurve = tractiveEffortCurveMap.get(Math.min(Math.max(0, position), path.getLength()));
        assert tractiveEffortCurve != null;
        double maxTractionForce = getMaxEffort(speed, tractiveEffortCurve);
        double rollingResistance = rollingStock.getRollingResistance(speed);
        double averageGrade = getAverageGrade(rollingStock, path, position);
        double weightForce = getWeightForce(rollingStock, averageGrade);

        if (action == Action.MAINTAIN) {
            tractionForce = rollingResistance - weightForce;
            if (tractionForce <= maxTractionForce) return newtonStep(timeStep, speed, 0, directionSign);
            else tractionForce = maxTractionForce;
        }

        if (action == Action.ACCELERATE) tractionForce = maxTractionForce;
        double acceleration =
                computeAcceleration(rollingStock, rollingResistance, weightForce, speed, tractionForce, directionSign);
        return newtonStep(timeStep, speed, acceleration, directionSign);
    }

    private double getDeceleration(double speed, double position) {
        assert (action == Action.BRAKE);
        if (brakingType == BrakingType.CONSTANT) return rollingStock.getDeceleration();

        var grade = getMinGrade(rollingStock, path, position);
        var gradientAcceleration = getGradientAcceleration(grade);
        return switch (brakingType) {
            // See Subset referenced in RJSEtcsBrakeParams: §3.13.6.2.1.3.
            case EBD -> -rollingStock.getRJSEtcsBrakeParams().getSafeBrakingAcceleration(speed) + gradientAcceleration;
            // See Subset referenced in RJSEtcsBrakeParams: §3.13.6.3.1.3.
            case SBD ->
                -rollingStock.getRJSEtcsBrakeParams().getServiceBrakingAcceleration(speed) + gradientAcceleration;
            // See Subset referenced in RJSEtcsBrakeParams: §3.13.6.4.3.
            case GUI ->
                -rollingStock.getRJSEtcsBrakeParams().getNormalServiceBrakingAcceleration(speed)
                        + gradientAcceleration
                        + rollingStock.getRJSEtcsBrakeParams().getGradientAccelerationCorrection(grade, speed);
            default -> throw new UnsupportedOperationException("Braking type not supported: " + brakingType);
        };
    }

    /** Compute the average grade of a rolling stock at a given position on a given path in m/km */
    public static double getAverageGrade(PhysicsRollingStock rollingStock, PhysicsPath path, double headPosition) {
        var tailPosition = Math.min(Math.max(0, headPosition - rollingStock.getLength()), path.getLength());
        headPosition = Math.min(Math.max(0, headPosition), path.getLength());
        return path.getAverageGrade(tailPosition, headPosition);
    }

    /** Compute the weight force of a rolling stock at a given position on a given path */
    public static double getWeightForce(PhysicsRollingStock rollingStock, double grade) {
        // get an angle from a m/km elevation difference
        // the curve's radius is taken into account in meanTrainGrade
        var angle = Math.atan(grade / 1000.0); // from m/km to m/m
        return -rollingStock.getMass() * GRAVITY_ACCELERATION * Math.sin(angle);
    }

    /** Compute the min grade of a rolling stock at a given position on a given path in m/km */
    public static double getMinGrade(PhysicsRollingStock rollingStock, PhysicsPath path, double headPosition) {
        var tailPosition = Math.min(Math.max(0, headPosition - rollingStock.getLength()), path.getLength());
        headPosition = Math.min(Math.max(0, headPosition), path.getLength());
        return path.getMinGrade(tailPosition, headPosition);
    }

    /**
     * Compute the acceleration given a rolling stock, different forces, a speed, and a direction
     */
    public static double computeAcceleration(
            PhysicsRollingStock rollingStock,
            double rollingResistance,
            double weightForce,
            double currentSpeed,
            double tractionForce,
            double directionSign) {

        assert tractionForce >= 0.;

        if (currentSpeed == 0 && directionSign > 0) {
            // If we are stopped and if the forces are not enough to compensate the opposite force,
            // the rolling resistance and braking force don't apply and the speed stays at 0
            // Unless we integrate backwards, then we need the speed to increase
            var totalOtherForce = tractionForce + weightForce;
            if (Math.abs(totalOtherForce) < rollingResistance) return 0.0;
        }

        // as the oppositeForces are reaction forces, they need to be adjusted to be opposed to the
        // other forces
        if (currentSpeed >= 0.0) {
            // if the train is moving forward or still, the opposite forces are negative
            return (tractionForce + weightForce - rollingResistance) / rollingStock.getInertia();
        } else {
            // if the train is moving backwards, the opposite forces are positive
            return (tractionForce + weightForce + rollingResistance) / rollingStock.getInertia();
        }
    }

    /** Integrate the Newton movement equations */
    public static IntegrationStep newtonStep(
            double timeStep, double currentSpeed, double acceleration, double directionSign) {
        var signedTimeStep = Math.copySign(timeStep, directionSign);
        var newSpeed = currentSpeed + acceleration * signedTimeStep;
        if (Math.abs(newSpeed) < SPEED_EPSILON) newSpeed = 0;

        // dx = currentSpeed * dt + 1/2 * acceleration * dt * dt
        var positionDelta = currentSpeed * signedTimeStep + 0.5 * acceleration * signedTimeStep * signedTimeStep;

        if (Math.abs(positionDelta) < POSITION_EPSILON) positionDelta = 0;
        return IntegrationStep.fromNaiveStep(
                timeStep, positionDelta,
                currentSpeed, newSpeed,
                acceleration, directionSign);
    }
}
