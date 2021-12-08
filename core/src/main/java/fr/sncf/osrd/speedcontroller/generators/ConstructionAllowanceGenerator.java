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
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/** Adds a construction margin to the given speed limits
 * The allowanceValue is in seconds, added over the whole phase */
public class ConstructionAllowanceGenerator extends MarecoAllowanceGenerator {

    static final double capacitySpeedLimit = 30 / 3.6;

    public ConstructionAllowanceGenerator(double begin, double end, double allowanceValue) {
        super(begin, end, allowanceValue, MarginType.TIME);
    }

    @Override
    protected double getFirstLowEstimate() {
        return 0.0;
    }

    @Override
    protected double getFirstHighEstimate(SortedDoubleMap speeds) {
        return max(speeds.values()) * DICHOTOMY_MARGIN;
    }

    @Override
    protected Set<SpeedController> getSpeedControllers(TrainSchedule schedule,
                                                       SortedDoubleMap speeds,
                                                       double targetSpeed) throws SimulationError {
        return getSpeedControllers(schedule, speeds, targetSpeed, sectionBegin, sectionEnd);
    }

    @Override
    protected Set<SpeedController> getSpeedControllers(TrainSchedule schedule,
                                                       SortedDoubleMap speeds,
                                                       double targetSpeed,
                                                       double begin,
                                                       double end) throws SimulationError {

        // compute the physical limits on the Region of Interest (RoI)
        // these limits are a composed of a braking curve at the beginning, an accelerating curve at the end,
        // with a 30km/h limit in between if it exists
        // TODO: move this somewhere so that it is only calculated once per dichotomy
        final SortedDoubleMap physicalLimits =
                generatePhysicalLimits(schedule, sectionBegin, sectionEnd, speeds, capacitySpeedLimit);

        // initial speed and final speed of the RoI
        var initialSpeed = speeds.interpolate(sectionBegin);
        var endSpeed = speeds.interpolate(sectionEnd);

        // initialize the beginning of the acceleration phase and the res variable
        double accelerationBeginPosition = sectionEnd;
        var res = new HashSet<>(maxSpeedControllers);

        if (targetSpeed < endSpeed) {
            // if the target speed is under the final speed of the Region of Interest (RoI)
            // that means there will be an acceleration phase at the end of the RoI to catch up with endSpeed
            var acceleratingCurve = generateAcceleratingCurveBackwards(
                    schedule, sectionBegin, endSpeed, sectionEnd, capacitySpeedLimit);
            // memorize the position where the accelerating curve crosses targetSpeed, if there is one
            for (var element : acceleratingCurve.entrySet()) {
                if (element.getValue() >= targetSpeed) {
                    accelerationBeginPosition = element.getKey();
                    break;
                }
            }
        }

        if (targetSpeed >= initialSpeed) {
            // if the target speed is above the initial speed, that means no coasting or braking is necessary
            // at the beginning of the Region of Interest (RoI)
            var marecoSpeedControllers = super.getSpeedControllers(
                    schedule, speeds, targetSpeed, sectionBegin, accelerationBeginPosition);
            res.addAll(marecoSpeedControllers);
            return res;
        }

        // compute a coasting phase starting at the beginning of the RoI
        // and ending either when is crosses the physical limits, or reaches regionEnd
        var coastingBeginPosition = sectionBegin;
        var speed = initialSpeed;
        var pos = coastingBeginPosition;
        var location = convertPosition(schedule, pos);
        var coastingPhase = new SortedDoubleMap();
        coastingPhase.put(pos, speed);
        do {
            var step = nextStep(
                    location,
                    speed,
                    schedule.rollingStock,
                    TIME_STEP,
                    sectionEnd,
                    1,
                    (integrator) -> Action.coast());
            speed = step.finalSpeed;
            location.updatePosition(schedule.rollingStock.length, step.positionDelta);
            pos = location.getPathPosition();
            coastingPhase.put(location.getPathPosition(), speed);
        } while (speed > physicalLimits.interpolate(pos) && pos < sectionEnd);

        var coastingFinalPosition = coastingPhase.lastKey();
        var coastingLowestSpeed = Collections.min(coastingPhase.values());

        // if the coasting curve reaches the physical limits and crosses targetSpeed
        // that means there is at least a small interval with a MARECO-like behavior
        if (coastingFinalPosition < sectionEnd && coastingLowestSpeed <= targetSpeed) {
            // memorize the position where the coasting phase crosses targetSpeed
            for (var element : coastingPhase.entrySet()) {
                if (element.getValue() <= targetSpeed) {
                    coastingFinalPosition = element.getKey();
                    break;
                }
            }
            res.add(new CoastingSpeedController(coastingBeginPosition, coastingFinalPosition));
            var marecoSpeedControllers = super.getSpeedControllers(
                    schedule, speeds, targetSpeed, coastingFinalPosition, accelerationBeginPosition
            );
            res.addAll(marecoSpeedControllers);
            return res;
        }

        // otherwise, that means the margin asked by the user is too high for a simple coasting phase followed by
        // an acceleration, in which case the train needs to brake before coasting

        var coastingBeginSpeed = initialSpeed;
        // transform the target speed into a coasting begin speed, located between initialSpeed and capacitySpeedLimit
        if (targetSpeed < capacitySpeedLimit)
            coastingBeginSpeed = targetSpeed * (initialSpeed / capacitySpeedLimit - 1) + capacitySpeedLimit;

        // memorize the position where the physical limit (i.e. the braking curve) crosses this coasting begin speed
        for (var element : physicalLimits.entrySet()) {
            if (element.getValue() <= coastingBeginSpeed) {
                coastingBeginPosition = element.getKey();
                break;
            }
        }

        // re-calculate the new coasting phase, that will start on the braking curve at coastingBeginSpeed
        // and end when it crosses the physical limits (if it does so)
        speed = coastingBeginSpeed;
        pos = coastingBeginPosition;
        location = convertPosition(schedule, pos);
        var newCoastingPhase = new SortedDoubleMap();
        newCoastingPhase.put(location.getPathPosition(), speed);
        do {
            var step = nextStep(
                    location,
                    speed,
                    schedule.rollingStock,
                    TIME_STEP,
                    sectionEnd,
                    1,
                    (integrator) -> Action.coast());
            speed = step.finalSpeed;
            location.updatePosition(schedule.rollingStock.length, step.positionDelta);
            pos = location.getPathPosition();
            newCoastingPhase.put(location.getPathPosition(), speed);
        } while (speed > physicalLimits.interpolate(pos) && pos < sectionEnd);

        // if the generated coasting curve reaches the physical limits
        // create a LimitAnnounceSpeedController until the coasting begin position
        // and a CoastingSpeedController right after, until the accelerating begin position
        if (coastingBeginPosition < sectionEnd) {
            coastingFinalPosition = location.getPathPosition();
            res.add(LimitAnnounceSpeedController.create(
                    initialSpeed, coastingBeginSpeed, coastingBeginPosition, schedule.rollingStock.gamma));
            res.add(new CoastingSpeedController(coastingBeginPosition, coastingFinalPosition));
            var marecoSpeedControllers = super.getSpeedControllers(
                    schedule, speeds, capacitySpeedLimit, coastingFinalPosition, accelerationBeginPosition
            );
            res.addAll(marecoSpeedControllers);
            return res;
        }

        // if not, that means no solution has been found including a coasting phase
        // so simply return the physical limits as set of speed controllers
        var brakingCurve =
                generateBrakingCurve(schedule, sectionBegin, initialSpeed, sectionEnd, capacitySpeedLimit);
        var acceleratingCurve =
                generateAcceleratingCurveBackwards(schedule, sectionBegin, endSpeed, sectionEnd, capacitySpeedLimit);
        var brakingLastPosition = brakingCurve.lastKey();
        accelerationBeginPosition = acceleratingCurve.firstKey();

        // manage the case where the barking curve intersects with the accelerating one
        if (brakingLastPosition >= accelerationBeginPosition) {
            for (double position : brakingCurve.keySet()) {
                if (brakingCurve.interpolate(position) <= acceleratingCurve.interpolate(position)) {
                    brakingLastPosition = position;
                    accelerationBeginPosition = position;
                    break;
                }
            }
        }

        res.add(LimitAnnounceSpeedController.createFromInitialPosition(
                initialSpeed, capacitySpeedLimit, sectionBegin, schedule.rollingStock.gamma));
        res.add(new MaxSpeedController(capacitySpeedLimit, brakingLastPosition, accelerationBeginPosition));
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
                                                               double initialPosition,
                                                               double endSpeed,
                                                               double endPosition,
                                                               double targetSpeed) {
        var res = new SortedDoubleMap();
        final double precision = 1E-1;
        var location = convertPosition(schedule, endPosition);
        double speed = endSpeed;
        res.put(location.getPathPosition(), speed);

        while (Math.abs(speed - targetSpeed) > precision && location.getPathPosition() > initialPosition) {
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
        if (location.getPathPosition() > initialPosition) {
            res.put(location.getPathPosition(), targetSpeed);
        }
        return res;
    }


    private SortedDoubleMap generatePhysicalLimits(TrainSchedule schedule,
                                                  double initialPosition,
                                                  double finalPosition,
                                                  SortedDoubleMap speeds,
                                                  double speedLimit) {
        var res = new SortedDoubleMap();
        var initialSpeed = speeds.interpolate(initialPosition);
        var finalSpeed = speeds.interpolate(finalPosition);
        var brakingCurve =
                generateBrakingCurve(schedule, initialPosition, initialSpeed, finalPosition, speedLimit);
        var acceleratingCurve =
                generateAcceleratingCurveBackwards(schedule, initialPosition, finalSpeed, finalPosition, speedLimit);
        var brakingLastPosition = brakingCurve.lastKey();
        var accelerationFirstPosition = acceleratingCurve.firstKey();

        // manage the case where the barking curve intersects with the accelerating one
        if (brakingLastPosition >= accelerationFirstPosition) {
            for (double pos : brakingCurve.keySet()) {
                if (brakingCurve.interpolate(pos) <= acceleratingCurve.interpolate(pos)) {
                    brakingLastPosition = pos;
                    accelerationFirstPosition = pos;
                    break;
                }
            }
            brakingCurve = (SortedDoubleMap) brakingCurve.subMap(brakingCurve.firstKey(), brakingLastPosition);
            acceleratingCurve =
                    (SortedDoubleMap) acceleratingCurve.subMap(acceleratingCurve.firstKey(), accelerationFirstPosition);
        }
        res.putAll(brakingCurve);
        res.putAll(acceleratingCurve);
        return res;
    }
}
