package fr.sncf.osrd.speedcontroller.generators;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.MapSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;

import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

public class MarginGenerator implements SpeedControllerGenerator {

    private final String marginType;
    private final double value;

    public MarginGenerator(double marginValue, String marginType) {
        this.marginType = marginType;
        this.value = marginValue;
    }

    @Override
    public Set<SpeedController> generate(Simulation sim, TrainSchedule schedule, Set<SpeedController> maxSpeed) {
        if (marginType.equals("T")) {
            var expectedSpeeds = getExpectedSpeeds(sim, schedule, maxSpeed, 1);
            double scaleFactor = 1 / (1 + value / 100);
            SpeedController speedController = new MapSpeedController(expectedSpeeds).scaled(scaleFactor);
            var res = new HashSet<SpeedController>();
            res.add(speedController);
            return res;
        } else {
            throw new RuntimeException(String.format("Margin type %s is not implemented", marginType));
        }
    }
}
