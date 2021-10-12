package fr.sncf.osrd.speedcontroller.generators;

import static java.lang.Math.min;
import static java.util.Collections.max;

import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.*;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.TrainPhysicsIntegrator;
import fr.sncf.osrd.train.TrainPhysicsIntegrator.PositionUpdate;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.utils.SortedDoubleMap;

import java.util.HashSet;
import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;

/** Adds a construction margin to the given speed limits
 * The allowanceValue is in seconds, added over the whole phase */
public class ConstructionAllowanceGenerator extends DichotomyControllerGenerator {

    public final double value;

    public ConstructionAllowanceGenerator(double begin, double end,
                                          double allowanceValue) {
        super(begin, end, 5 * TIME_STEP);
        this.value = allowanceValue;
    }

    @Override
    protected double getTargetTime(double baseTime) {
        return baseTime + value;
    }

    @Override
    protected double getFirstLowEstimate() {
        return 0.0;
    }

    @Override
    protected double getFirstHighEstimate() {
        var speeds = getExpectedSpeeds(sim, schedule, maxSpeedControllers, TIME_STEP);
        return max(speeds.values());
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
                                                       double endPosition) {
        var currentSpeedControllers = new HashSet<>(maxSpeedControllers);

        // running calculation to get the initial speed of the Region Of Interest (ROI)
        var expectedSpeeds = getExpectedSpeeds(sim, schedule, currentSpeedControllers, TIME_STEP,
                0, initialPosition, schedule.initialSpeed);
        var initialSpeed = expectedSpeeds.interpolate(initialPosition);
        var requiredBrakingDistance = Double.max(0,
                computeBrakingDistance(initialPosition, endPosition, initialSpeed, targetSpeed, schedule));
        var endBrakingPosition = initialPosition + requiredBrakingDistance;

        // running calculation starting where the braking ends, to create a scaled MapSpeedController from it
        var roiSpeeds = getExpectedSpeeds(sim, schedule, currentSpeedControllers, TIME_STEP,
                endBrakingPosition, endPosition, initialSpeed);
        double maxSpeed = max(roiSpeeds.values());
        double scaleFactor = targetSpeed / maxSpeed; // Value proposed by Dichotomy / max speed
        currentSpeedControllers.add(new MapSpeedController(roiSpeeds).scaled(scaleFactor));
        var res = new HashSet<>(maxSpeedControllers);

        if (endBrakingPosition != initialPosition) {
            SpeedController brakingSpeedController;
            if (schedule.rollingStock.gammaType == RollingStock.GammaType.CONST) {
                brakingSpeedController = new LimitAnnounceSpeedController(
                        initialSpeed * scaleFactor,
                        initialPosition,
                        endBrakingPosition,
                        schedule.rollingStock.gamma);
            } else {
                //TODO: optimise, this calculation is done twice
                var updatesMap = getUpdatesAtPositionsToTarget(sim, schedule,
                        initialPosition, initialSpeed, endBrakingPosition, initialSpeed * scaleFactor);
                var speeds = new SortedDoubleMap();
                for (var k : updatesMap.keySet()) {
                    speeds.put(k, updatesMap.get(k).speed);
                }
                brakingSpeedController = new BrakingSpeedController(speeds, initialPosition, endBrakingPosition);
            }
            currentSpeedControllers.add(brakingSpeedController);
            res.add(brakingSpeedController);
        }

        // new running calculation with brakingSpeedController + scaled MapSpeedController
        // now only the re-acceleration phase is missing
        var newSpeeds = getExpectedSpeeds(sim, schedule, currentSpeedControllers, TIME_STEP,
                initialPosition, endPosition, initialSpeed);

        // backwards acceleration calculation
        double speed = roiSpeeds.interpolate(endPosition); //The speed is calculated from the old running time
        var location = convertPosition(schedule, sim, endPosition);
        while (speed > newSpeeds.interpolate(location.getPathPosition()) && location.getPathPosition() > 0.) {
            var directive = new SpeedDirective(newSpeeds.interpolate(location.getPathPosition()));
            var update = TrainPhysicsIntegrator.computeNextStepFromDirective(
                    location,
                    speed,
                    directive,
                    schedule.rollingStock,
                    TIME_STEP,
                    location.getPathPosition(),
                    -1
            );
            speed = update.speed;
            location.updatePosition(schedule.rollingStock.length, update.positionDelta);
        }

        var initialSpeedControllers = new HashSet<>(maxSpeedControllers);
        // scaled MapSpeedControllers only between the end of the braking phase and the beginning of the acceleration
        var speedsEndingEarlier = getExpectedSpeeds(sim, schedule, initialSpeedControllers, TIME_STEP,
                endBrakingPosition, location.getPathPosition(), initialSpeed);
        speedsEndingEarlier.put(endBrakingPosition, targetSpeed); // add first point to the future MapSpeedController
        res.add(new MapSpeedController(speedsEndingEarlier).scaled(scaleFactor));

        return res;
    }

    /** compute the braking distance from (initialPosition,initialSpeed) to a given target speed */
    @Override
    protected double computeBrakingDistance(double initialPosition, double endPosition,
                                         double initialSpeed, double targetSpeed, TrainSchedule schedule) {

        if (schedule.rollingStock.gammaType == RollingStock.GammaType.CONST)
            return (initialSpeed * initialSpeed - targetSpeed * targetSpeed) / (2 * schedule.rollingStock.gamma);

        var res = getUpdatesAtPositionsToTarget(sim, schedule,
                initialPosition, initialSpeed, endPosition, targetSpeed);
        return res.lastKey() - res.firstKey();
    }

    /** compute the running time calculation from (initialPosition,initialSpeed) to a given target speed */
    private NavigableMap<Double, PositionUpdate> getUpdatesAtPositionsToTarget(Simulation sim,
                                                                               TrainSchedule schedule,
                                                                               double initialPosition,
                                                                               double initialSpeed,
                                                                               double endPosition,
                                                                               double targetSpeed) {

        var res = new TreeMap<Double, TrainPhysicsIntegrator.PositionUpdate>();
        var stopIndex = 0;
        var location = convertPosition(schedule, sim, initialPosition);
        var totalLength = 0.;
        for (var range : schedule.plannedPath.trackSectionPath)
            totalLength += range.length();
        totalLength = min(totalLength, endPosition);
        double speed = initialSpeed;
        var inertia = schedule.rollingStock.mass * schedule.rollingStock.inertiaCoefficient;
        var action = Action.brake(schedule.rollingStock.gamma * inertia);
        do {
            var update = TrainPhysicsIntegrator.computeNextStepFromAction(
                    location,
                    speed,
                    action,
                    schedule.rollingStock,
                    TIME_STEP,
                    totalLength,
                    1
            );
            speed = update.speed;

            location.updatePosition(schedule.rollingStock.length, update.positionDelta);
            res.put(location.getPathPosition(), update);
            if (speed <= 0) {
                stopIndex++;
                if (stopIndex >= schedule.stops.size())
                    break;
            }
        } while (speed > targetSpeed && location.getPathPosition() + TIME_STEP * speed < totalLength);
        return res;
    }
}
