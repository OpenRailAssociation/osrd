package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.speedcontroller.generators.MaxSpeedGenerator;
import fr.sncf.osrd.speedcontroller.generators.SpeedControllerGenerator;

import java.util.HashSet;
import java.util.Set;

public class SpeedControllerSet {
    private final Set<SpeedController> maxSpeedControllers;
    private final Set<SpeedController> desiredSpeedControllers;

    public SpeedControllerSet(TrainSchedule schedule) {
        this(schedule, new HashSet<>());
    }

    public SpeedControllerSet(TrainSchedule schedule, Set<SpeedControllerGenerator> desiredSpeedGenerators) {
        maxSpeedControllers = new MaxSpeedGenerator().generate(schedule);
        desiredSpeedControllers = new HashSet<>(maxSpeedControllers);
        for (var gen : desiredSpeedGenerators)
            desiredSpeedControllers.addAll(gen.generate(schedule));
    }

    public SpeedDirective getMaxSpeedDirective(double position) {
        return SpeedController.getDirective(maxSpeedControllers.toArray(SpeedController[]::new), position);
    }

    public SpeedDirective getDesiredSpeedDirective(double position) {
        return SpeedController.getDirective(desiredSpeedControllers.toArray(SpeedController[]::new), position);
    }
}
