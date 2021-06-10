package fr.sncf.osrd.speedcontroller.generators;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.LinearAllowance.MarginType;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPhase;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.MapSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;

import java.util.HashSet;
import java.util.Set;

public class LinearAllowanceGenerator extends SpeedControllerGenerator {

    private final MarginType allowanceType;
    private final double value;

    public LinearAllowanceGenerator(double allowanceValue, MarginType allowanceType, RJSTrainPhase phase) {
        super(phase);
        this.allowanceType = allowanceType;
        this.value = allowanceValue;
    }

    @Override
    public Set<SpeedController> generate(Simulation sim, TrainSchedule schedule, Set<SpeedController> maxSpeed) {
        // find the percentage of the allowance to add to the whole path
        double percentage;
        if (allowanceType.equals(MarginType.TIME))
            percentage = value;
        else {
            // TODO compute the margin only on the phase range
            var expectedTime = getExpectedTimes(sim, schedule, maxSpeed, 1);
            var totalTime = expectedTime.lastEntry().getValue() - expectedTime.firstEntry().getValue();
            var schemaLength = expectedTime.lastEntry().getKey() - expectedTime.firstEntry().getKey();
            var n = schemaLength / 100000;
            var totalAllowance = n * value;
            percentage = 100.0 * totalAllowance / totalTime;
        }
        var expectedSpeeds = getExpectedSpeeds(sim, schedule, maxSpeed, 1);
        double scaleFactor = 1 / (1 + percentage / 100);
        SpeedController speedController = new MapSpeedController(expectedSpeeds).scaled(scaleFactor);
        var res = new HashSet<SpeedController>();
        res.add(speedController);
        return res;
    }
}