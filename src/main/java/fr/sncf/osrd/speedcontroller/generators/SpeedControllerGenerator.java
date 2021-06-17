package fr.sncf.osrd.speedcontroller.generators;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPhysicsIntegrator;
import fr.sncf.osrd.train.TrainPhysicsIntegrator.PositionUpdate;

import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

/** This interface is used to generate a set of SpeedController (similar to a speed at any given point). */
public interface SpeedControllerGenerator {

    /** Generates the set of SpeedController */
    Set<SpeedController> generate(Simulation sim, TrainSchedule schedule, Set<SpeedController> maxSpeed);

    /** Generates a map of location -> expected time if we follow the given controllers.
     * This may be overridden in scenarios when it is already computed when computing the controllers */
    default NavigableMap<Double, Double> getExpectedTimes(Simulation sim,
                                                          TrainSchedule schedule,
                                                          Set<SpeedController> controllers,
                                                          double timestep) {
        var updatesMap
                = getUpdatesAtPositions(sim, schedule, controllers, timestep);
        var res = new TreeMap<Double, Double>();
        double time = schedule.departureTime;
        for (var k : updatesMap.keySet()) {
            time += updatesMap.get(k).timeDelta;
            res.put(k, time);
        }
        return res;
    }

    /** Generates a map of location -> expected speed if we follow the given controllers */
    default NavigableMap<Double, Double> getExpectedSpeeds(Simulation sim,
                                                           TrainSchedule schedule,
                                                           Set<SpeedController> controllers,
                                                           double timestep) {
        var updatesMap
                = getUpdatesAtPositions(sim, schedule, controllers, timestep);
        var res = new TreeMap<Double, Double>();
        for (var k : updatesMap.keySet()) {
            res.put(k, updatesMap.get(k).speed);
        }
        return res;
    }

    /** Generates a map of location -> updates if we follow the given controllers.
     * This may be overridden in scenarios when it is already computed when computing the controllers */
    default NavigableMap<Double, PositionUpdate> getUpdatesAtPositions(Simulation sim,
                                                                       TrainSchedule schedule,
                                                                       Set<SpeedController> controllers,
                                                                       double timestep) {
        var location = Train.getInitialLocation(schedule, sim);
        var totalLength = 0;
        for (var range : schedule.fullPath)
            totalLength += Math.abs(range.getBeginPosition() - range.getEndPosition());

        var res = new TreeMap<Double, PositionUpdate>();

        double speed = 0;
        do {
            var activeControllers = controllers.stream()
                    .filter(x -> x.isActive(location))
                    .collect(Collectors.toSet());
            var directive = SpeedController.getDirective(activeControllers, location.getPathPosition());

            var integrator = TrainPhysicsIntegrator.make(timestep, schedule.rollingStock,
                    speed, location.maxTrainGrade());
            var action = integrator.actionToTargetSpeed(directive, schedule.rollingStock);
            var distanceLeft = totalLength - location.getPathPosition();
            var update =  integrator.computeUpdate(action, distanceLeft);
            speed = update.speed;

            location.updatePosition(schedule.rollingStock.length, update.positionDelta);
            res.put(location.getPathPosition(), update);
        } while (location.getPathPosition() < totalLength && speed > 0);
        return res;
    }
}
