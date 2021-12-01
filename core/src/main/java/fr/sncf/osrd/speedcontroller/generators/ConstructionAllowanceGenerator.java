package fr.sncf.osrd.speedcontroller.generators;

import static fr.sncf.osrd.train.TrainPhysicsIntegrator.*;
import static java.lang.Math.min;
import static java.util.Collections.max;

import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.MarginType;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.IntegrationStep;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.speedcontroller.*;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.utils.SortedDoubleMap;
import java.util.HashSet;
import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;

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
        var currentSpeedControllers = new HashSet<>(maxSpeedControllers);

        // running calculation to get the initial speed and final speed of the Region Of Interest (ROI)
        var expectedSpeeds = getExpectedSpeeds(schedule, currentSpeedControllers, TIME_STEP,
                0, endPosition, schedule.initialSpeed);
        var initialSpeed = expectedSpeeds.interpolate(initialPosition);
        var res = new HashSet<>(maxSpeedControllers);

        // acceleration phase
        // it is computed in order to get its beginning position
        // later, this phase will be used in case the user asks for a high margin in a short distance
        var speed = expectedSpeeds.interpolate(endPosition);
        var location = convertPosition(schedule, endPosition);
        var acceleratingPhase = new SortedDoubleMap();
        acceleratingPhase.put(location.getPathPosition(), speed);
        while (speed > targetSpeed && location.getPathPosition() > initialPosition) {
            var stepSpeed = speed;
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
            acceleratingPhase.put(location.getPathPosition(), stepSpeed);
        }

        // coasting phase
        speed = initialSpeed;
        location = convertPosition(schedule, initialPosition);
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
        var accelerationFirstPosition = acceleratingPhase.firstKey();
        // if the coasting phase does not intersect the accelerating one,
        // that means there is at least a small interval with a MARECO-like behavior
        if (coastingLastPosition <= accelerationFirstPosition) {
            //throw new SimulationError("Construction margin value too high for such short distance");
            if (coastingPhase.size() > 1) {
                res.add(new CoastingSpeedController(initialPosition, coastingLastPosition));
            }
            var marecoSpeedControllers =
                    super.getSpeedControllers(schedule, targetSpeed, coastingLastPosition, accelerationFirstPosition);
            res.addAll(marecoSpeedControllers);
        } else {
            // otherwise, that means the margin asked by the user is too high for a simple coasting phase
            // in which case the train needs to brake before coasting
            speed = initialSpeed;
            location = convertPosition(schedule, initialPosition);
            var brakingPhase = new SortedDoubleMap();
            while (location.getPathPosition() < endPosition) {
                var step = nextStep(
                        location,
                        speed,
                        schedule.rollingStock,
                        TIME_STEP,
                        endPosition,
                        1,
                        (integrator) -> Action.brake(
                                schedule.rollingStock.gamma * schedule.rollingStock.inertiaCoefficient
                        ));
                brakingPhase.put(location.getPathPosition(), speed);
                speed = step.finalSpeed;
                location.updatePosition(schedule.rollingStock.length, step.positionDelta);
            }
            brakingPhase.put(location.getPathPosition(), targetSpeed);
            // re-calculate the new coasting phase
            speed = targetSpeed;
            location = convertPosition(schedule, accelerationFirstPosition);
            var newCoastingPhase = new SortedDoubleMap();
            while (speed > brakingPhase.interpolate(location.getPathPosition())
                    && location.getPathPosition() < endPosition) {
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
            newCoastingPhase.put(location.getPathPosition(), targetSpeed);
            res.add(LimitAnnounceSpeedController.create(
                    initialSpeed, speed, location.getPathPosition(), schedule.rollingStock.gamma));
            res.add(new CoastingSpeedController(location.getPathPosition(), accelerationFirstPosition));
        }
        return res;
    }

    /** compute the braking distance from (initialPosition,initialSpeed) to a given target speed */
    @Override
    protected double computeBrakingDistance(double initialPosition, double endPosition, double initialSpeed,
                                            double targetSpeed, TrainSchedule schedule) {

        if (schedule.rollingStock.gammaType == RollingStock.GammaType.CONST)
            return (initialSpeed * initialSpeed - targetSpeed * targetSpeed) / (2 * schedule.rollingStock.gamma);

        var res = getStepsAtPositionsToTarget(schedule,
                initialPosition, initialSpeed, endPosition, targetSpeed);
        return res.lastKey() - res.firstKey();
    }

    /** compute the running time calculation from (initialPosition,initialSpeed) to a given target speed */
    private NavigableMap<Double, IntegrationStep> getStepsAtPositionsToTarget(TrainSchedule schedule,
                                                                              double initialPosition,
                                                                              double initialSpeed,
                                                                              double endPosition,
                                                                              double targetSpeed) {

        var res = new TreeMap<Double, IntegrationStep>();
        var stopIndex = 0;
        var location = convertPosition(schedule, initialPosition);
        var totalLength = 0.;
        for (var range : schedule.plannedPath.trackSectionPath)
            totalLength += range.length();
        totalLength = min(totalLength, endPosition);
        double speed = initialSpeed;
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
            res.put(location.getPathPosition(), step);
            if (speed <= 0) {
                stopIndex++;
                if (stopIndex >= schedule.stops.size())
                    break;
            }
        } while (speed > targetSpeed && location.getPathPosition() + TIME_STEP * speed < totalLength);
        return res;
    }
}
