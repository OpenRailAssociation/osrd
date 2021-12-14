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
public final class ConstructionAllowanceGenerator extends MarecoAllowanceGenerator {

    // speed limit of 30km/h under which the train would use too much capacity
    static final double capacitySpeedLimit = 30 / 3.6;
    private SortedDoubleMap physicalLimits = null;
    private SortedDoubleMap speeds = null;

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
    protected void initializeBinarySearch(TrainSchedule schedule, SortedDoubleMap speeds) {
        physicalLimits = generatePhysicalLimits(schedule, speeds);
        this.speeds = speeds;
    }

    @Override
    protected Set<SpeedController> getSpeedControllers(TrainSchedule schedule,
                                                       double targetSpeed,
                                                       double begin,
                                                       double end) throws SimulationError {

        // initial speed and final speed of the RoI
        var initialSpeed = speeds.interpolate(sectionBegin);
        var endSpeed = speeds.interpolate(sectionEnd);

        // initialize the beginning of the acceleration phase and the res variable
        double accelerationBeginPosition = getAccelerationBeginPosition(targetSpeed, endSpeed);

        if (targetSpeed >= initialSpeed) {
            // if the target speed is above the initial speed, that means no coasting or braking is necessary
            // at the beginning of the Region of Interest (RoI)
            return super.getSpeedControllers(schedule, targetSpeed, sectionBegin, accelerationBeginPosition);
        }

        // compute a coasting curve starting at the beginning of the RoI
        // and ending either when is crosses the physical limits, or reaches regionEnd
        var coastingBeginPosition = sectionBegin;
        var coastingCurve = generateCoastingCurve(coastingBeginPosition, initialSpeed);
        var coastingFinalPosition = coastingCurve.lastKey();
        var coastingLowestSpeed = Collections.min(coastingCurve.values());

        // if the coasting curve reaches the physical limits and crosses targetSpeed
        // that means there is at least a small interval with a MARECO-like behavior
        if (coastingFinalPosition < sectionEnd && coastingLowestSpeed <= targetSpeed) {
            return makeResultWithoutBraking(coastingCurve, targetSpeed, accelerationBeginPosition);
        }

        // otherwise, that means the margin asked by the user is too high for a simple coasting phase followed by
        // an acceleration, in which case the train needs to brake before coasting

        // re-calculate the new coasting phase, that will start on the braking curve at coastingBeginSpeed
        // and end when it crosses the physical limits (if it does so)
        coastingBeginPosition = computeCoastingBeginPosition(initialSpeed, targetSpeed);
        var coastingBeginSpeed = physicalLimits.interpolate(coastingBeginPosition);
        var newCoastingCurve = generateCoastingCurve(coastingBeginPosition, coastingBeginSpeed);

        // if the generated coasting curve reaches the physical limits
        // create a LimitAnnounceSpeedController until the coasting begin position
        // and a CoastingSpeedController right after, until the accelerating begin position
        if (coastingFinalPosition < sectionEnd) {
            return makeResultWithBraking(newCoastingCurve, coastingBeginSpeed, accelerationBeginPosition);
        }

        // if not, that means no solution has been found including a coasting phase
        // so simply return the physical limits as set of speed controllers
        return makeResultWithPhysicalLimits(initialSpeed, endSpeed);
    }

    /** return the physical limits as a set of speedControllers */
    private Set<SpeedController> makeResultWithPhysicalLimits(double initialSpeed, double endSpeed) {
        var brakingCurve =
                generateBrakingCurve(schedule, sectionBegin, initialSpeed, sectionEnd, capacitySpeedLimit);
        var acceleratingCurve =
                generateAcceleratingCurveBackwards(schedule, sectionBegin, endSpeed, sectionEnd, capacitySpeedLimit);
        var brakingLastPosition = brakingCurve.lastKey();
        var accelerationBeginPosition = acceleratingCurve.firstKey();

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

        var res = new HashSet<>(maxSpeedControllers);
        res.add(LimitAnnounceSpeedController.createFromInitialPosition(
                initialSpeed, capacitySpeedLimit, sectionBegin, schedule.rollingStock.gamma));
        res.add(new MaxSpeedController(capacitySpeedLimit, brakingLastPosition, accelerationBeginPosition));
        return res;
    }

    /** return a construction margin space-speed curve starting with a braking phase,
     *  and a coasting phase if that is possible */
    private Set<SpeedController> makeResultWithBraking(SortedDoubleMap coastingCurve,
                                                       double coastingBeginSpeed,
                                                       double accelerationBeginPosition) throws SimulationError {
        var res = new HashSet<>(maxSpeedControllers);
        var coastingBeginPosition = coastingCurve.firstKey();
        var initialSpeed = speeds.interpolate(sectionBegin);
        var coastingFinalPosition = coastingCurve.lastKey();
        if (coastingFinalPosition < sectionEnd) {
            // if a possible coasting curve has been found, add a CoastingSpeedController
            res.add(new CoastingSpeedController(coastingBeginPosition, coastingFinalPosition));
        } else {
            // manage the case where coasting doesn't work (accelerating slope for example)
            coastingFinalPosition = coastingBeginPosition;
        }
        res.add(LimitAnnounceSpeedController.create(
                initialSpeed, coastingBeginSpeed, coastingBeginPosition, schedule.rollingStock.gamma));
        var marecoSpeedControllers = super.getSpeedControllers(
                schedule, capacitySpeedLimit, coastingFinalPosition, accelerationBeginPosition
        );
        res.addAll(marecoSpeedControllers);
        return res;
    }

    /** return a construction margin space-speed curve starting with a simple coasting phase */
    private Set<SpeedController> makeResultWithoutBraking(SortedDoubleMap coastingCurve,
                                                          double targetSpeed,
                                                          double accelerationBeginPosition) throws SimulationError {

        var res = new HashSet<>(maxSpeedControllers);
        var coastingBeginPosition = sectionBegin;
        var coastingFinalPosition = coastingCurve.lastKey();

        // memorize the position where the coasting phase crosses targetSpeed
        for (var element : coastingCurve.entrySet()) {
            if (element.getValue() <= targetSpeed) {
                coastingFinalPosition = element.getKey();
                break;
            }
        }
        res.add(new CoastingSpeedController(coastingBeginPosition, coastingFinalPosition));
        var marecoSpeedControllers = super.getSpeedControllers(
                schedule, targetSpeed, coastingFinalPosition, accelerationBeginPosition
        );
        res.addAll(marecoSpeedControllers);
        return res;
    }

    /** compute where the coasting phase is supposed to start, given the initial and target speed */
    private double computeCoastingBeginPosition(double initialSpeed, double targetSpeed) {
        var coastingBeginSpeed = initialSpeed;
        // transform the target speed into a coasting begin speed, located between initialSpeed and capacitySpeedLimit
        if (targetSpeed < capacitySpeedLimit)
            coastingBeginSpeed = targetSpeed * (initialSpeed / capacitySpeedLimit - 1) + capacitySpeedLimit;

        // memorize the position where the physical limit (i.e. the braking curve) crosses this coasting begin speed
        for (var element : physicalLimits.entrySet()) {
            if (element.getValue() <= coastingBeginSpeed) {
                // TODO: replace this by an interpolated position to avoid discretization issues
                return element.getKey();
            }
        }
        return sectionBegin;
    }

    /** generate a space-speed curve corresponding to a coasting starting at (initialPosition, initialSpeed)
     *  and ending when it intersects with the physical limits curve */
    private SortedDoubleMap generateCoastingCurve(double initialPosition, double initialSpeed) {
        var speed = initialSpeed;
        var pos = initialPosition;
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
            coastingPhase.put(pos, speed);
        } while (speed > physicalLimits.interpolate(pos) && pos < sectionEnd);
        return coastingPhase;
    }

    /** compute the position where the train should re-accelerate to catch up with endSpeed at sectionEnd */
    private double getAccelerationBeginPosition(double targetSpeed, double endSpeed) {
        if (targetSpeed >= endSpeed)
            return sectionEnd;
        // if the target speed is under the final speed of the Region of Interest (RoI)
        // that means there will be an acceleration phase at the end of the RoI to catch up with endSpeed
        var acceleratingCurve = generateAcceleratingCurveBackwards(
                schedule, sectionBegin, endSpeed, sectionEnd, capacitySpeedLimit);
        // memorize the position where the accelerating curve crosses targetSpeed, if there is one
        for (var element : acceleratingCurve.entrySet()) {
            if (element.getValue() >= targetSpeed) {
                // TODO: replace this by an interpolated position to avoid discretization issues
                return element.getKey();
            }
        }
        return sectionEnd;
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

    /** compute the physical limits on the Region of Interest (RoI)
     * these limits are a composed of a braking curve at the beginning, an accelerating curve at the end,
     * with a 30km/h limit in between if it exists */
    private SortedDoubleMap generatePhysicalLimits(TrainSchedule schedule,
                                                     SortedDoubleMap speeds) {
        var res = new SortedDoubleMap();
        var initialSpeed = speeds.interpolate(sectionBegin);
        var finalSpeed = speeds.interpolate(sectionEnd);
        var brakingCurve =
                generateBrakingCurve(schedule, sectionBegin, initialSpeed, sectionEnd, capacitySpeedLimit);
        var acceleratingCurve =
                generateAcceleratingCurveBackwards(schedule, sectionBegin, finalSpeed, sectionEnd, capacitySpeedLimit);
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
