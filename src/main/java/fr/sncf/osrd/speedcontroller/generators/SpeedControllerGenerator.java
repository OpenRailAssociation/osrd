package fr.sncf.osrd.speedcontroller.generators;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.speedcontroller.SpeedController;

import java.util.Set;

public interface SpeedControllerGenerator {
    Set<SpeedController> generate(TrainSchedule schedule);
}
