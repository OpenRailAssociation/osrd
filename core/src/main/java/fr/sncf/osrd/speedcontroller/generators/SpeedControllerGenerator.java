package fr.sncf.osrd.speedcontroller.generators;

import static fr.sncf.osrd.train.TrainPhysicsIntegrator.*;
import static java.lang.Math.abs;
import static java.lang.Math.min;

import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.IntegrationStep;
import fr.sncf.osrd.train.*;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.utils.SortedDoubleMap;
import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;

/** This class is used to generate a set of SpeedController (similar to a speed at any given point). */
public abstract class SpeedControllerGenerator {

    protected double sectionBegin;
    protected double sectionEnd;

    public static final double TIME_STEP = 0.4;

    protected SpeedControllerGenerator(double begin, double end) {
        this.sectionBegin = begin;
        this.sectionEnd = end;
    }

    /** Get the beginning position */
    public double getBegin() {
        return sectionBegin;
    }

    /** Get the end position */
    public double getEnd() {
        return sectionEnd;
    }

    /** Generates the set of SpeedController */
    public abstract Set<SpeedController> generate(Simulation sim, TrainSchedule schedule,
                                                  Set<SpeedController> maxSpeeds) throws SimulationError;

    /** Generates a map of location -> expected time if we follow the given controllers. */
    public static SortedDoubleMap getExpectedTimes(TrainSchedule schedule,
                                                   Set<SpeedController> controllers,
                                                   double timeStep,
                                                   double begin,
                                                   double end,
                                                   double initialSpeed,
                                                   boolean includeStops) {
        var updatesMap
                = getIntegrationStepsAtPositions(schedule, controllers, timeStep, begin, end, initialSpeed);
        var res = new SortedDoubleMap();

        assert schedule.departureTime >= 0; // This could fail if there is a bug with train successions
        double time = schedule.departureTime;

        int stopIndex = 0;
        for (var k : updatesMap.keySet()) {
            time += updatesMap.get(k).timeDelta;
            if (stopIndex < schedule.stops.size() && schedule.stops.get(stopIndex).position <= k) {
                if (includeStops) {
                    res.put(k - 1e-10, time); // prevents any problem when interpolating near a stop
                    time += schedule.stops.get(stopIndex).stopDuration;
                }
                stopIndex++;
            }
            res.put(k, time);
        }

        // Adds the duration of the last stop(s) which may not have been reached
        var lastEntry = res.lastEntry();
        while (stopIndex < schedule.stops.size()) {
            res.put(lastEntry.getKey(), lastEntry.getValue() + schedule.stops.get(stopIndex).stopDuration);
            stopIndex++;
        }
        return res;
    }

    /** Generates a map of location -> expected time if we follow the given controllers. */
    public SortedDoubleMap getExpectedTimes(TrainSchedule schedule,
                                            Set<SpeedController> controllers,
                                            double timestep,
                                            boolean includeStops) {
        var initialSpeed = findInitialSpeed(schedule, controllers, timestep);
        return getExpectedTimes(schedule, controllers, timestep,
                sectionBegin, sectionEnd, initialSpeed, includeStops);
    }

    /** Generates a map of location -> expected speed if we follow the given controllers. */
    public SortedDoubleMap getExpectedSpeeds(TrainSchedule schedule,
                                             Set<SpeedController> controllers,
                                             double timestep) {
        var initialSpeed = findInitialSpeed(schedule, controllers, timestep);
        return getExpectedSpeeds(schedule, controllers, timestep,
                sectionBegin, sectionEnd, initialSpeed);
    }

    /** Generates a map of location -> expected speed if we follow the given controllers */
    public static SortedDoubleMap getExpectedSpeeds(TrainSchedule schedule,
                                             Set<SpeedController> controllers,
                                             double timestep,
                                             double begin,
                                             double end,
                                             double initialSpeed) {
        var updatesMap
                = getIntegrationStepsAtPositions(schedule, controllers, timestep, begin, end, initialSpeed);
        var res = new SortedDoubleMap();
        for (var k : updatesMap.keySet()) {
            res.put(k, updatesMap.get(k).finalSpeed);
        }
        return res;
    }

    /** used to convert the double position into a TrainPositionTracker*/
    public static TrainPositionTracker convertPosition(TrainSchedule schedule, double position) {
        var location = TrainPositionTracker.from(schedule.plannedPath);
        location.updatePosition(schedule.rollingStock.length, position);
        return location;
    }

    /** Generates a map of location -> updates if we follow the given controllers. */
    public static NavigableMap<Double, IntegrationStep> getIntegrationStepsAtPositions(
            TrainSchedule schedule,
            Set<SpeedController> controllers,
            double timeStep,
            double begin,
            double end,
            double initialSpeed
    ) {
        var location = convertPosition(schedule, begin);
        var totalLength = schedule.plannedPath.length;
        final var actualEnd = min(end, totalLength);
        var res = new TreeMap<Double, IntegrationStep>();
        var stopIndex = 0;

        double speed = initialSpeed;
        do {
            int currentStopIndex = stopIndex;
            var step = nextStep(
                    location,
                    speed,
                    schedule.rollingStock,
                    timeStep,
                    actualEnd,
                    1,
                    (integrator) -> integrator.computeActionFromControllers(controllers, actualEnd, currentStopIndex));

            speed = step.finalSpeed;
            location.updatePosition(schedule.rollingStock.length, step.positionDelta);
            res.put(location.getPathPosition(), step);
            var nextStop = schedule.stops.get(stopIndex);
            if (location.getPathPosition() > nextStop.position - 1e-2) {
                stopIndex++;
                if (stopIndex >= schedule.stops.size())
                    break;
            }
        } while (location.getPathPosition() + timeStep * speed < actualEnd - 1e-5);
        assert abs(location.getPathPosition() - actualEnd) < timeStep * speed + 1e-2;
        return res;
    }

    /** Finds the position (as a double) corresponding to the beginning of the allowance */
    protected double findInitialSpeed(TrainSchedule schedule, Set<SpeedController> maxSpeed,
                                      double timeStep) {
        if (sectionBegin <= 0)
            return schedule.initialSpeed;
        var speeds = getExpectedSpeeds(schedule, maxSpeed, timeStep,
                0, sectionBegin, schedule.initialSpeed);
        return speeds.lastEntry().getValue();
    }

    /** Generates a map of location -> expected speed starting from (endPosition, speedLimit)
     * and going backwards till maxSpeed */
    public SortedDoubleMap getExpectedSpeedsBackwards(
            TrainSchedule schedule,
            double speedLimit,
            double endPosition,
            double maxSpeed,
            double timeStep) {

        SortedDoubleMap expectedSpeeds = new SortedDoubleMap();
        var speed = speedLimit;
        var inertia = schedule.rollingStock.mass * schedule.rollingStock.inertiaCoefficient;
        // It starts from the endPosition going backwards
        var location = convertPosition(schedule, endPosition);
        expectedSpeeds.put(location.getPathPosition(), speed);
        // TODO: max Gamma could have different values depending on the speed like in ERTMS
        var action = Action.brake(abs(schedule.rollingStock.gamma * inertia));
        while (speed < maxSpeed && location.getPathPosition() >= 0.0001) {
            var step = nextStep(
                    location,
                    speed,
                    schedule.rollingStock,
                    timeStep,
                    location.getPathPosition(),
                    -1,
                    (integrator) -> action
            );
            speed = step.finalSpeed;
            expectedSpeeds.put(location.getPathPosition(), speed);
            if (location.getPathPosition() + step.positionDelta < 0) break;
            location = convertPosition(schedule, location.getPathPosition() + step.positionDelta);
        }

        return expectedSpeeds;
    }

}
