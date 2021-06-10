package fr.sncf.osrd.speedcontroller.generators;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPhase;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.utils.Interpolation;

import java.util.Set;

/** TODO comments */
public abstract class DichotomyControllerGenerator extends SpeedControllerGenerator {

    private double initialSpeed;
    private final double precision;
    protected Set<SpeedController> maxSpeedControllers;
    protected TrainSchedule schedule;

    protected DichotomyControllerGenerator(RJSTrainPhase phase, double precision) {
        super(phase);
        this.precision = precision;
    }

    @Override
    public Set<SpeedController> generate(Simulation sim, TrainSchedule schedule, Set<SpeedController> speedControllers) {
        double beginPosition = findPhaseInitialLocation(schedule);
        double endPosition = findPhaseEndLocation(schedule);
        var initialSpeeds = getExpectedSpeeds(sim, schedule, speedControllers, 1,
                beginPosition, endPosition, schedule.initialSpeed);
        initialSpeed = Interpolation.interpolate(initialSpeeds, beginPosition);
        this.schedule = schedule;
        this.maxSpeedControllers = speedControllers;
        return binarySearch(sim, schedule);
    }

    protected double evalRunTime(Simulation sim, TrainSchedule schedule, Set<SpeedController> speedControllers) {
        var totalTime = getExpectedTimes(sim, schedule, speedControllers, 1,
                findPhaseInitialLocation(schedule), findPhaseEndLocation(schedule), initialSpeed);
        return totalTime.lastEntry().getValue() - totalTime.firstEntry().getValue();
    }

    protected abstract double getTargetTime(double baseTime);

    protected abstract double getFirstLowEstimate();

    protected abstract double getFirstHighEstimate();

    protected abstract Set<SpeedController> getSpeedControllers(double value);

    private Set<SpeedController> binarySearch(Simulation sim, TrainSchedule schedule) {
        var lowerBound = getFirstLowEstimate();
        var higherBound = getFirstHighEstimate();
        var time = evalRunTime(sim, schedule, maxSpeedControllers);
        var targetTime = getTargetTime(time);
        var beginLocation = findPhaseInitialLocation(schedule);
        var endLocation = findPhaseEndLocation(schedule);

        double nextValue;
        Set<SpeedController> nextSpeedController;
        do {
            nextValue = (lowerBound + higherBound) / 2;
            nextSpeedController = getSpeedControllers(nextValue);
            var expectedTimes = getExpectedTimes(sim, schedule,
                    nextSpeedController, 1, beginLocation, endLocation, initialSpeed);
            time = expectedTimes.lastEntry().getValue() - expectedTimes.firstEntry().getValue();
            if (time > targetTime)
                lowerBound = nextValue;
            else
                higherBound = nextValue;
        } while( Math.abs(time - targetTime) > precision);
        return nextSpeedController;
    }

}
