package fr.sncf.osrd.speedcontroller.generators;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.railjson.schema.schedule.RJSRunningTimeParameters;
import fr.sncf.osrd.railjson.schema.schedule.RJSRunningTimeParameters.Margin.MarginType;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.MapSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;

import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

import static fr.sncf.osrd.railjson.schema.schedule.RJSRunningTimeParameters.Margin.MarginType.*;

public class MarginGenerator implements SpeedControllerGenerator {

    private final MarginType marginType;
    private final double value;

    public MarginGenerator(double marginValue, MarginType marginType) {
        this.marginType = marginType;
        this.value = marginValue;
    }

    @Override
    public Set<SpeedController> generate(Simulation sim, TrainSchedule schedule, Set<SpeedController> maxSpeed) {
        switch (marginType) {
            case TIME:
                var expectedSpeeds = getExpectedSpeeds(sim, schedule, maxSpeed, 1);
                double scaleFactor = 1 / (1 + value / 100);
                SpeedController speedController = new MapSpeedController(expectedSpeeds).scaled(scaleFactor);
                var res = new HashSet<SpeedController>();
                res.add(speedController);
                return res;
            default:
                throw new RuntimeException(String.format("Margin type %s is not implemented", marginType));
        }
    }
}
