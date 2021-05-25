package fr.sncf.osrd.speedcontroller.generators;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPhysicsIntegrator;

import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

public interface SpeedControllerGenerator {
    Set<SpeedController> generate(TrainSchedule schedule);

    /** Generates a map of location -> expected time if we follow the given controllers.
     * This may be overridden in scenarios when it is already computed when computing the controllers */
    default NavigableMap<Double, Double> getExpectedTimes(Simulation sim,
                                                          TrainSchedule schedule,
                                                          Set<SpeedController> controllers,
                                                          double timestep) {
        var location = Train.getInitialLocation(schedule, sim);
        var totalLength = 0;
        for (var range : schedule.fullPath)
            totalLength += Math.abs(range.getBeginPosition() - range.getEndPosition());
        var res = new TreeMap<Double, Double>();

        double time = schedule.departureTime;
        double speed = 1;
        while (location.getPathPosition() < totalLength && speed > 0) {
            res.put(location.getPathPosition(), time);
            var activeControllers = controllers.stream()
                    .filter(x -> x.isActive(location))
                    .collect(Collectors.toSet());
            var directive = SpeedController.getDirective(activeControllers, location.getPathPosition());
            speed = directive.allowedSpeed;
            time += timestep;
            location.updatePosition(schedule.rollingStock.length, speed * timestep);
        }
        return res;
    }
}
