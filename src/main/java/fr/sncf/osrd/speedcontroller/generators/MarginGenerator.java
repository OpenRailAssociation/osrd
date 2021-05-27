package fr.sncf.osrd.speedcontroller.generators;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.speedcontroller.SpeedController;

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
    public Set<SpeedController> generate(TrainSchedule schedule, Set<SpeedController> maxSpeed) {
        if (marginType.equals("T")) {
            return maxSpeed.stream()
                    .map(x -> x.scaled(value))
                    .collect(Collectors.toSet());
        } else {
            throw new RuntimeException(String.format("Margin type %s is not implemented", marginType));
        }
    }
}
