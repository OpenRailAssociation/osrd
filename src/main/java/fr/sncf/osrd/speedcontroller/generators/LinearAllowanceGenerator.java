package fr.sncf.osrd.speedcontroller.generators;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.LinearAllowance.MarginType;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPhase;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.MapSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;

import java.util.*;

public class LinearAllowanceGenerator extends SpeedControllerGenerator {

    private final MarginType allowanceType;
    private final double value;

    public LinearAllowanceGenerator(double allowanceValue, MarginType allowanceType, RJSTrainPhase phase) {
        super(phase);
        this.allowanceType = allowanceType;
        this.value = allowanceValue;
    }

    @Override
    public Set<SpeedController> generate(Simulation sim, TrainSchedule schedule,
                                         Set<SpeedController> maxSpeed, double initialSpeed) {
        double timeStep = 1;
        double begin = findPhaseInitialLocation(schedule);
        double end = findPhaseEndLocation(schedule);
        // find the percentage of the allowance to add to the whole path
        double percentage;
        if (allowanceType.equals(MarginType.TIME))
            percentage = value;
        else {
            // TODO compute the margin only on the phase range
            var expectedTime = getExpectedTimes(sim, schedule, maxSpeed, timeStep,
                    begin, end, initialSpeed);
            var totalTime = expectedTime.lastEntry().getValue() - expectedTime.firstEntry().getValue();
            var schemaLength = expectedTime.lastEntry().getKey() - expectedTime.firstEntry().getKey();
            var n = schemaLength / 100000;
            var totalAllowance = n * value;
            percentage = 100.0 * totalAllowance / totalTime;
        }
        double scaleFactor = 1 / (1 + percentage / 100);

        // This is needed to have a similar distance delta per step, needed for the shift (see next comment)
        double expectedSpeedTimeStep = timeStep * scaleFactor;

        var expectedSpeeds = getExpectedSpeeds(sim, schedule, maxSpeed, expectedSpeedTimeStep,
                begin, end, initialSpeed);

        // We shift the speed limits by one position: the max speed at t is the speed at t + dt
        // This is because we use the position of the train to evaluate the target speed at the next simulation step
        // Once this offset is removed (and the associated bugs fixed), we can remove this block
        var keys = new ArrayList<>(expectedSpeeds.navigableKeySet());
        var speedLimits = new TreeMap<Double, Double>();
        for (int i = 1; i < keys.size(); i++)
            speedLimits.put(keys.get(i - 1), expectedSpeeds.get(keys.get(i)));
        speedLimits.put(expectedSpeeds.lastKey(), expectedSpeeds.lastEntry().getValue());

        return addSpeedController(maxSpeed, new MapSpeedController(speedLimits).scaled(scaleFactor));
    }

    static Set<SpeedController> addSpeedController(Set<SpeedController> speedControllers,
                                                   SpeedController newSpeedController) {
        var res = new HashSet<>(speedControllers);
        res.add(newSpeedController);
        return res;
    }
}