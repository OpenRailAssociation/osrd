package fr.sncf.osrd.speedcontroller.generators;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.MapSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;

import java.util.HashSet;
import java.util.Set;

public class AllowanceGenerator implements SpeedControllerGenerator {

    private final String allowanceType;
    private final double value;

    public AllowanceGenerator(double allowanceValue, String allowanceType) {
        this.allowanceType = allowanceType;
        this.value = allowanceValue;
    }

    @Override
    public Set<SpeedController> generate(Simulation sim, TrainSchedule schedule, Set<SpeedController> maxSpeed) {
        if (allowanceType.equals("T")) {
            var expectedSpeeds = getExpectedSpeeds(sim, schedule, maxSpeed, 1);
            double scaleFactor = 1 / (1 + value / 100);
            SpeedController speedController = new MapSpeedController(expectedSpeeds).scaled(scaleFactor);
            var res = new HashSet<SpeedController>();
            res.add(speedController);
            return res;
        } else {
            throw new RuntimeException(String.format("Allowance type %s is not implemented", allowanceType));
        }
    }
}
