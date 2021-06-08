package fr.sncf.osrd.speedcontroller.generators;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.railjson.schema.common.RJSTrackLocation;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.LinearAllowance.MarginType;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPhase;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.MapSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;

import java.util.HashSet;
import java.util.NavigableMap;
import java.util.Set;

public class ConstructionAllowanceGenerator implements SpeedControllerGenerator {

    private final double value;
    private final RJSTrainPhase phase;

    public ConstructionAllowanceGenerator(double allowanceValue, RJSTrainPhase phase) {
        this.value = allowanceValue;
        this.phase = phase;
    }

    @Override
    public Set<SpeedController> generate(Simulation sim, TrainSchedule schedule, Set<SpeedController> maxSpeed) {
        // the goal is to find a new allowed speed to create a MaxSpeedController

        // perform the whole running time calculation
        var expectedSpeeds = getExpectedSpeeds(sim, schedule, maxSpeed, 1);
        double initialPosition = findPhaseInitialpoint(schedule, phase);
        var initialSpeed = expectedSpeeds.get(initialPosition); //TODO use mapSpeedController

        // lunch the binary search algorithm into the phase
        var speedController = binarySearch(0.5, initialPosition, initialSpeed, phase.endLocation, sim, schedule, maxSpeed);
        var res = new HashSet<SpeedController>();
        res.add(speedController);
        return res;
    }

    private SpeedController binarySearch(Double precision, Double initialPosition, Double initialSpeed,
                                         RJSTrackLocation endLocation, Simulation sim,
                                         TrainSchedule schedule, Set<SpeedController> maxSpeed) {
        SpeedController speedController;
        var finalPosition = endLocation.offset;
        var totalTime = getExpectedTimes(sim, schedule, maxSpeed, 1, initialPosition, finalPosition, initialSpeed);
        var time = Double.POSITIVE_INFINITY;
        var targetTime = totalTime.lastEntry().getValue() + value;

        var vMinus = 0.0;
        var vPlus = 83.3;//TODO find the allowed speed from maxSpeed
        var percentage = 100.0 * value / time;
        var scaleFactor = 1 / (1 + percentage / 100);
        vPlus = vPlus * scaleFactor;

        while( Math.abs(time - targetTime) > precision ) {
            double allowedSpeed = (vPlus + vMinus) / 2;
            maxSpeed = modifySpeedControllers(maxSpeed, allowedSpeed);
            var expectedTimes = getExpectedTimes(sim, schedule, maxSpeed, 1, initialPosition, finalPosition, initialSpeed);
            time = expectedTimes.lastEntry().getValue();
            if (time > targetTime)
                vMinus = allowedSpeed;
            else
                vPlus = allowedSpeed;
        }
        //TODO create new speedController
        return speedController;
    }

    private Set<SpeedController> modifySpeedControllers(Set<SpeedController> maxSpeed, double allowedSpeed) {

        return maxSpeed;
    }
}