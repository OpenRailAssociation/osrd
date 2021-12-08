package fr.sncf.osrd.speedcontroller.generators;

import static fr.sncf.osrd.train.TrainPhysicsIntegrator.*;
import static java.lang.Math.abs;
import static java.lang.Math.min;
import static java.util.Collections.max;

import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.MarginType;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.speedcontroller.*;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.utils.SortedDoubleMap;
import java.util.HashSet;
import java.util.Set;

/** Adds a construction margin to the given speed limits
 * The allowanceValue is in seconds, added over the whole phase */
public class ConstructionAllowanceGenerator extends MarecoAllowanceGenerator {

    public ConstructionAllowanceGenerator(double begin, double end,
                                          double allowanceValue) {
        super(begin, end, allowanceValue, MarginType.TIME);
    }

    @Override
    protected double getFirstLowEstimate() {
        return 0.0;
    }

    @Override
    protected double getFirstHighEstimate() {
        var speeds = getExpectedSpeeds(schedule, maxSpeedControllers, TIME_STEP);
        return max(speeds.values()) * DICHOTOMY_MARGIN;
    }

    @Override
    protected double getFirstGuess() {
        // first guess is the mean value between max and min
        return (this.getFirstHighEstimate() + this.getFirstLowEstimate()) / 2;
    }

    @Override
    protected Set<SpeedController> getSpeedControllers(TrainSchedule schedule,
                                                       double targetSpeed,
                                                       double initialPosition,
                                                       double endPosition) throws SimulationError {

        // for later implementation, speed limit under which a train would consume too much capacity
        final double capacitySpeedLimit = 30 / 3.6;

        var currentSpeedControllers = new HashSet<>(maxSpeedControllers);

        // running calculation to get the initial speed and final speed of the Region Of Interest (ROI)
        var expectedSpeeds = getExpectedSpeeds(schedule, currentSpeedControllers, TIME_STEP,
                0, endPosition, schedule.initialSpeed);
        var initialSpeed = expectedSpeeds.interpolate(initialPosition);
        var endSpeed = expectedSpeeds.interpolate(endPosition);
        double accelerationBeginPosition = endPosition;
        var res = new HashSet<>(maxSpeedControllers);

        if (targetSpeed < endSpeed) {
            // if the target speed is under the final speed of the Region of Interest (RoI)
            // that means there will be an acceleration phase at the end of the RoI to catch up with endSpeed
            var acceleratingPhase =
                    generateAcceleratingCurveBackwards(schedule, endPosition, endSpeed, initialPosition, targetSpeed);
            // memorize the position where the accelerating curve crosses targetSpeed, if there is one
            for (var element : acceleratingPhase.entrySet()) {
                if (element.getValue() <= targetSpeed) {
                    accelerationBeginPosition = element.getKey();
                    break;
                }
            }
        }

        if (targetSpeed >= initialSpeed) {
            // if the target speed is above the initial speed, that means no coasting or braking is necessary
            // at the beginning of the Region of Interest (RoI)
            var marecoSpeedControllers =
                    super.getSpeedControllers(schedule, targetSpeed, initialPosition, accelerationBeginPosition);
            res.addAll(marecoSpeedControllers);
            return res;
        }

        // compute a coasting phase starting at the beginning of the RoI
        var speed = initialSpeed;
        var location = convertPosition(schedule, initialPosition);
        var coastingPhase = new SortedDoubleMap();
        while (speed > targetSpeed && location.getPathPosition() < endPosition) {
            var step = nextStep(
                    location,
                    speed,
                    schedule.rollingStock,
                    TIME_STEP,
                    endPosition,
                    1,
                    (integrator) -> Action.coast());
            coastingPhase.put(location.getPathPosition(), speed);
            speed = step.finalSpeed;
            location.updatePosition(schedule.rollingStock.length, step.positionDelta);
        }
        coastingPhase.put(location.getPathPosition(), targetSpeed);
        var coastingLastPosition = coastingPhase.lastKey();

        // if the coasting phase does not intersect the accelerating one,
        // that means there is at least a small interval with a MARECO-like behavior
        if (coastingLastPosition <= accelerationBeginPosition) {
            if (coastingPhase.size() > 1) {
                res.add(new CoastingSpeedController(initialPosition, coastingLastPosition));
            }
            var marecoSpeedControllers =
                    super.getSpeedControllers(schedule, targetSpeed, coastingLastPosition, accelerationBeginPosition);
            res.addAll(marecoSpeedControllers);
            return res;
        }
        // otherwise, that means the margin asked by the user is too high for a simple coasting phase
        // followed by an acceleration, in which case the train needs to brake before coasting

        // initiate the braking last position
        double brakingLastPosition = initialPosition;
        var brakingPhase =
                generateBrakingCurve(schedule, initialPosition, initialSpeed, endPosition, 0.0);
        // memorize the position where the braking curve crosses targetSpeed, if there is one
        for (var element : brakingPhase.entrySet()) {
            if (element.getValue() <= targetSpeed) {
                brakingLastPosition = element.getKey();
                break;
            }
        }

        // If the braking curve crosses the accelerating one before reaching targetSpeed
        // that means the user has been asking for a margin that is physically too high is this interval.
        // Same if the target speed becomes too low.
        if (brakingLastPosition > accelerationBeginPosition || targetSpeed < capacitySpeedLimit / 2)
            //TODO: implement the fact that the speed should not be lower than capacitySpeedLimit
            throw new SimulationError("Margin asked by the user is too high for such short distance.");

        // re-calculate the new coasting phase, that will start somewhere on the braking curve
        // and end at target speed on the accelerating curve
        speed = targetSpeed;
        location = convertPosition(schedule, accelerationBeginPosition);
        var newCoastingPhase = new SortedDoubleMap();
        while (speed > brakingPhase.interpolate(location.getPathPosition())
                && speed > 0
                && location.getPathPosition() > initialPosition) {
            var step = nextStep(
                    location,
                    speed,
                    schedule.rollingStock,
                    TIME_STEP,
                    endPosition,
                    -1,
                    (integrator) -> Action.coast());
            newCoastingPhase.put(location.getPathPosition(), speed);
            speed = step.finalSpeed;
            location.updatePosition(schedule.rollingStock.length, step.positionDelta);
        }
        newCoastingPhase.put(location.getPathPosition(), speed);
        var coastingFirstPosition = location.getPathPosition();
        var coastingFirstSpeed = speed;

        // create a LimitAnnounceSpeedController until the first coasting position
        // and a CoastingSpeedController right after, until the first accelerating position
        res.add(LimitAnnounceSpeedController.create(
                initialSpeed, coastingFirstSpeed, coastingFirstPosition, schedule.rollingStock.gamma));
        res.add(new CoastingSpeedController(location.getPathPosition(), accelerationBeginPosition));
        return res;
    }

    /** compute the braking distance from (initialPosition,initialSpeed) to a given target speed */
    @Override
    protected double computeBrakingDistance(double initialPosition, double endPosition, double initialSpeed,
                                            double targetSpeed, TrainSchedule schedule) {

        if (schedule.rollingStock.gammaType == RollingStock.GammaType.CONST)
            return (initialSpeed * initialSpeed - targetSpeed * targetSpeed) / (2 * schedule.rollingStock.gamma);

        var res = generateBrakingCurve(schedule,
                initialPosition, initialSpeed, endPosition, targetSpeed);
        return res.lastKey() - res.firstKey();
    }

    /** compute the running time calculation from (initialPosition,initialSpeed) to a given target speed */
    private SortedDoubleMap generateBrakingCurve(TrainSchedule schedule,
                                                 double initialPosition,
                                                 double initialSpeed,
                                                 double endPosition,
                                                 double targetSpeed) {

        var res = new SortedDoubleMap();
        var stopIndex = 0;
        var location = convertPosition(schedule, initialPosition);
        var totalLength = 0.;
        for (var range : schedule.plannedPath.trackSectionPath)
            totalLength += range.length();
        totalLength = min(totalLength, endPosition);
        double speed = initialSpeed;
        res.put(location.getPathPosition(), speed);
        var inertia = schedule.rollingStock.mass * schedule.rollingStock.inertiaCoefficient;
        var action = Action.brake(schedule.rollingStock.gamma * inertia);
        do {
            var step = nextStep(
                    location,
                    speed,
                    schedule.rollingStock,
                    TIME_STEP,
                    totalLength,
                    1,
                    (integrator) -> action
            );
            speed = step.finalSpeed;

            location.updatePosition(schedule.rollingStock.length, step.positionDelta);
            res.put(location.getPathPosition(), speed);
            if (speed <= 0) {
                stopIndex++;
                if (stopIndex >= schedule.stops.size())
                    break;
            }
        } while (speed > targetSpeed && location.getPathPosition() + TIME_STEP * speed < totalLength);
        return res;
    }

    /** compute the running time calculation from (initialPosition,initialSpeed) to a given target speed */
    private SortedDoubleMap generateAcceleratingCurveBackwards(TrainSchedule schedule,
                                                               double endPosition,
                                                               double endSpeed,
                                                               double initialPosition,
                                                               double targetSpeed) {
        var res = new SortedDoubleMap();
        var location = convertPosition(schedule, endPosition);
        double speed = endSpeed;
        res.put(location.getPathPosition(), speed);

        while (speed > targetSpeed && location.getPathPosition() > initialPosition) {
            var directive = new SpeedDirective(targetSpeed);
            var step = nextStep(
                    location,
                    speed,
                    schedule.rollingStock,
                    TIME_STEP,
                    location.getPathPosition(),
                    -1,
                    (integrator) -> integrator.actionToTargetSpeed(directive, schedule.rollingStock, -1));
            speed = step.finalSpeed;
            location.updatePosition(schedule.rollingStock.length, step.positionDelta);
            res.put(location.getPathPosition(), speed);
        }
        return res;
    }
}
