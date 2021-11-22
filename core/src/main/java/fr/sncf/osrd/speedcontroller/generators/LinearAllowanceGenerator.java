package fr.sncf.osrd.speedcontroller.generators;

import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.LinearAllowance.MarginType;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.MapSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.TrainSchedule;
import java.util.HashSet;
import java.util.Set;

public class LinearAllowanceGenerator extends SpeedControllerGenerator {

    public final MarginType allowanceType;
    public final double value;

    /** Constructor */
    public LinearAllowanceGenerator(double begin, double end,
                                    double allowanceValue, MarginType allowanceType) {
        super(begin, end);
        this.allowanceType = allowanceType;
        this.value = allowanceValue;
    }

    @Override
    public Set<SpeedController> generate(Simulation sim, TrainSchedule schedule,
                                         Set<SpeedController> maxSpeeds) {
        // find the percentage of the allowance to add to the whole path
        double percentage;
        if (allowanceType.equals(MarginType.PERCENTAGE))
            percentage = value;
        else { // allowanceType = DISTANCE
            var totalStopsDuration = schedule.getStopDuration();
            var expectedTime = getExpectedTimes(schedule, maxSpeeds, TIME_STEP);
            var totalTime = expectedTime.lastEntry().getValue() - expectedTime.firstEntry().getValue();
            var schemaLength = expectedTime.lastEntry().getKey() - expectedTime.firstEntry().getKey();
            var n = schemaLength / 100000; // number of portions of 100km in the train journey
            var totalAllowanceMinutes = n * value; // margin value is in minutes per 100km
            var totalAllowanceSeconds = totalAllowanceMinutes * 60;
            // the margin should not affect the stop durations,
            // so the percentage is calculated without the total stop duration
            percentage = 100.0 * totalAllowanceSeconds / (totalTime - totalStopsDuration);
        }
        double scaleFactor = 1 / (1 + percentage / 100);

        var expectedSpeeds = getExpectedSpeeds(schedule, maxSpeeds, TIME_STEP);
        var speedController = new MapSpeedController(expectedSpeeds, sectionBegin, sectionEnd);
        return addSpeedController(maxSpeeds, speedController.scaled(scaleFactor));
    }

    static Set<SpeedController> addSpeedController(Set<SpeedController> speedControllers,
                                                   SpeedController newSpeedController) {
        var res = new HashSet<>(speedControllers);
        res.add(newSpeedController);
        return res;
    }
}