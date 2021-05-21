package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.speedcontroller.generators.MaxSpeedGenerator;
import fr.sncf.osrd.speedcontroller.generators.SpeedControllerGenerator;

import java.util.HashSet;
import java.util.Set;

public class SpeedControllerSet {
    public final Set<SpeedController> maxSpeedControllers;
    public final Set<SpeedController> desiredSpeedControllers;

    public SpeedControllerSet(TrainSchedule schedule) {
        this(schedule, new HashSet<>());
    }

    public SpeedControllerSet(TrainSchedule schedule, Set<SpeedControllerGenerator> desiredSpeedGenerators) {
        maxSpeedControllers = new MaxSpeedGenerator().generate(schedule);
        desiredSpeedControllers = new HashSet<>(maxSpeedControllers);
        for (var gen : desiredSpeedGenerators)
            desiredSpeedControllers.addAll(gen.generate(schedule));
    }

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
