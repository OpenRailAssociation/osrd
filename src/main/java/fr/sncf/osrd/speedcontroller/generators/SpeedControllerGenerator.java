package fr.sncf.osrd.speedcontroller.generators;

import static java.lang.Math.min;

import fr.sncf.osrd.train.*;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.TrainPhysicsIntegrator.PositionUpdate;
import fr.sncf.osrd.utils.SortedDoubleMap;
import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

/** This class is used to generate a set of SpeedController (similar to a speed at any given point). */
public abstract class SpeedControllerGenerator {

    protected double sectionBegin;
    protected double sectionEnd;

    public static final double TIME_STEP = 0.1;

    protected SpeedControllerGenerator(double begin, double end) {
        this.sectionBegin = begin;
        this.sectionEnd = end;
    }

    /** Generates the set of SpeedController */
    public abstract Set<SpeedController> generate(Simulation sim, TrainSchedule schedule,
                                                  Set<SpeedController> maxSpeeds);

    /** Generates a map of location -> expected time if we follow the given controllers. */
    public static SortedDoubleMap getExpectedTimes(Simulation sim,
                                            TrainSchedule schedule,
                                            Set<SpeedController> controllers,
                                            double timestep,
                                            double begin,
                                            double end,
                                            double initialSpeed) {
        var updatesMap
                = getUpdatesAtPositions(sim, schedule, controllers, timestep, begin, end, initialSpeed);
        var res = new SortedDoubleMap();
        double time = schedule.departureTime;
        int stopIndex = 0;
        for (var k : updatesMap.keySet()) {
            time += updatesMap.get(k).timeDelta;
            if (stopIndex < schedule.stops.size() && schedule.stops.get(stopIndex).position <= k) {
                var duration = schedule.stops.get(stopIndex).stopDuration;
                if (duration > 0)
                    time += duration;
                stopIndex++;
            }
            res.put(k, time);
        }
        return res;
    }

    /** Generates a map of location -> expected time if we follow the given controllers. */
    public SortedDoubleMap getExpectedTimes(Simulation sim,
                                            TrainSchedule schedule,
                                            Set<SpeedController> controllers,
                                            double timestep) {
        var initialSpeed = findInitialSpeed(sim, schedule, controllers, timestep);
        return getExpectedTimes(sim, schedule, controllers, timestep,
                sectionBegin, sectionEnd, initialSpeed);
    }

    /** Generates a map of location -> expected speed if we follow the given controllers. */
    public SortedDoubleMap getExpectedSpeeds(Simulation sim,
                                             TrainSchedule schedule,
                                             Set<SpeedController> controllers,
                                             double timestep) {
        var initialSpeed = findInitialSpeed(sim, schedule, controllers, timestep);
        return getExpectedSpeeds(sim, schedule, controllers, timestep,
                sectionBegin, sectionEnd, initialSpeed);
    }

    /** Generates a map of location -> expected speed if we follow the given controllers */
    public static SortedDoubleMap getExpectedSpeeds(Simulation sim,
                                             TrainSchedule schedule,
                                             Set<SpeedController> controllers,
                                             double timestep,
                                             double begin,
                                             double end,
                                             double initialSpeed) {
        var updatesMap
                = getUpdatesAtPositions(sim, schedule, controllers, timestep, begin, end, initialSpeed);
        var res = new SortedDoubleMap();
        for (var k : updatesMap.keySet()) {
            res.put(k, updatesMap.get(k).speed);
        }
        return res;
    }

    /** used to convert the double position into a TrainPositionTracker*/
    public static TrainPositionTracker convertPosition(TrainSchedule schedule, Simulation sim, double position) {
        var location = Train.getInitialLocation(schedule, sim);
        location.ignoreInfraState = true;
        location.updatePosition(schedule.rollingStock.length, position);
        return location;
    }

    /** Generates a map of location -> updates if we follow the given controllers. */
    public static NavigableMap<Double, PositionUpdate> getUpdatesAtPositions(Simulation sim,
                                                                      TrainSchedule schedule,
                                                                      Set<SpeedController> controllers,
                                                                      double timestep,
                                                                      double begin,
                                                                      double end,
                                                                      double initialSpeed) {
        var location = convertPosition(schedule, sim, begin);
        var totalLength = 0.;
        for (var range : schedule.plannedPath.trackSectionPath)
            totalLength += range.length();
        totalLength = min(totalLength, end);

        var res = new TreeMap<Double, PositionUpdate>();
        var stopIndex = 0;

        double speed = initialSpeed;
        do {
            var nextPosition = location.getPathPosition() + speed * timestep;
            final var finalNextPosition = min(nextPosition, end);
            final int finalStopIndex = stopIndex;
            var activeControllers = controllers.stream()
                    .filter(x -> x.isActive(finalNextPosition, finalStopIndex))
                    .collect(Collectors.toSet());
            var directive = SpeedController.getDirective(activeControllers, nextPosition, stopIndex);

            var integrator = TrainPhysicsIntegrator.make(timestep, schedule.rollingStock,
                    speed, location.meanTrainGrade());
            var action = integrator.actionToTargetSpeed(directive, schedule.rollingStock);
            var distanceLeft = min(totalLength - location.getPathPosition(), end - location.getPathPosition());
            var update =  integrator.computeUpdate(action, distanceLeft);
            speed = update.speed;

            location.updatePosition(schedule.rollingStock.length, update.positionDelta);
            res.put(location.getPathPosition(), update);
            if (speed <= 0) {
                stopIndex++;
                if (stopIndex >= schedule.stops.size())
                    break;
            }
        } while (location.getPathPosition() + timestep * speed < totalLength);
        return res;
    }

    /** Finds the position (as a double) corresponding to the beginning of the allowance */
    protected double findInitialSpeed(Simulation sim, TrainSchedule schedule, Set<SpeedController> maxSpeed,
                                      double timeStep) {
        if (sectionBegin <= 0)
            return schedule.initialSpeed;
        var speeds = getExpectedSpeeds(sim, schedule, maxSpeed, timeStep,
                0, sectionBegin, schedule.initialSpeed);
        return speeds.lastEntry().getValue();
    }

    /** Generates a map of location -> expected speed starting from (endPosition, speedLimit)
     * and going backwards till maxSpeed */
    public SortedDoubleMap getExpectedSpeedsBackwards(
            Simulation sim,
            TrainSchedule schedule,
            double speedLimit,
            double endPosition,
            double maxSpeed,
            double timestep) {

        SortedDoubleMap expectedSpeeds = new SortedDoubleMap();
        var speed = speedLimit;
        var inertia = schedule.rollingStock.mass * schedule.rollingStock.inertiaCoefficient;
        // It starts from the endPosition going backwards
        var location = convertPosition(schedule, sim, endPosition);

        do {
            expectedSpeeds.put(location.getPathPosition(), speed);
            var integrator = TrainPhysicsIntegrator.make(timestep, schedule.rollingStock,
                    speed, location.meanTrainGrade());
            // TODO: max Gamma could have different values depending on the speed like in ERTMS
            var action = Action.brake(Math.abs(schedule.rollingStock.gamma * inertia));
            var update =  integrator.computeUpdate(action, location.getPathPosition(),
                    -1);
            speed = update.speed;
            //TODO: We can now just call updatePosition with a negative delta
            location = convertPosition(schedule, sim, location.getPathPosition() + update.positionDelta);
        } while (speed < maxSpeed && location.getPathPosition() >= 0.0001);

        return expectedSpeeds;
    }

}
