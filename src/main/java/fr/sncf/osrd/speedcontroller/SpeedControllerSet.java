package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.speedcontroller.generators.MaxSpeedGenerator;
import fr.sncf.osrd.speedcontroller.generators.SpeedControllerGenerator;

import java.util.HashSet;
import java.util.Set;

/** Contains all the pre-computed speed controller and indications.
 * For now it contains data about desired speed (with margin or mareco), and max speed for when the train is
 * running late. Later on, we may add other indications such as when to coast. */
public class SpeedControllerSet {
    public final Set<SpeedController> maxSpeedControllers;
    public final Set<SpeedController> desiredSpeedControllers;

    /** Generates the base speed controllers, where desired speed = max speed
     * @param schedule train schedule */
    public SpeedControllerSet(TrainSchedule schedule) {
        this(schedule, new HashSet<>());
    }

    /** Generates the desired speed controllers from the given generators. Max speed is always determined
     * from a `new MaxSpeedGenerator`.
     * @param schedule train schedule
     * @param desiredSpeedGenerators set of generators used for desired speed controllers */
    public SpeedControllerSet(TrainSchedule schedule, Set<SpeedControllerGenerator> desiredSpeedGenerators) {
        maxSpeedControllers = new MaxSpeedGenerator().generate(schedule);
        desiredSpeedControllers = new HashSet<>(maxSpeedControllers);
        for (var gen : desiredSpeedGenerators)
            desiredSpeedControllers.addAll(gen.generate(schedule));
    }

    /** Copy constructor */
    public SpeedControllerSet(SpeedControllerSet other) {
        this.maxSpeedControllers = new HashSet<>(other.maxSpeedControllers);
        this.desiredSpeedControllers = new HashSet<>(other.desiredSpeedControllers);
    }

    @Override
    public String toString() {
        var res = new StringBuilder();
        res.append("max speed controllers: {");
        for (var controller: maxSpeedControllers) {
            res.append(controller);
            res.append(", ");
        }
        res.append("}, desired speed controllers: {");
        for (var controller: desiredSpeedControllers) {
            res.append(controller);
            res.append(", ");
        }
        res.append("}");
        return res.toString();
    }
}
