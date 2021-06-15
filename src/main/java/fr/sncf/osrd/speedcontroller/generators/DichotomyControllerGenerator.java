package fr.sncf.osrd.speedcontroller.generators;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPhase;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.events.TrainReachesActionPoint;
import fr.sncf.osrd.utils.Interpolation;

import java.io.FileNotFoundException;
import java.io.PrintWriter;
import java.io.UnsupportedEncodingException;
import java.util.ArrayList;
import java.util.NavigableMap;
import java.util.Set;

/** Generates a set of speed controller using a generic dichotomy */
public abstract class DichotomyControllerGenerator extends SpeedControllerGenerator {

    /** Expected speed at the beginning of the phase */
    private double initialSpeed;

    /** We stop the dichotomy when the result is this close to the target (in seconds) */
    private final double precision;

    /** Set of speed controllers describing the max speed */
    protected Set<SpeedController> maxSpeedControllers;

    /** Train schedule */
    protected TrainSchedule schedule;

    /** Expected times from previous evaluation */
    protected NavigableMap<Double, Double> expectedTimes;

    /** Simulation state given in `generate` parameters */
    protected Simulation sim;

    /** Constructor
     * @param phase given rjs train phase
     * @param precision how close we need to be to the target time (in seconds) */
    protected DichotomyControllerGenerator(RJSTrainPhase phase, double precision) {
        super(phase);
        this.precision = precision;
    }

    /** Generates a set of speed controller using dichotomy */
    @Override
    public Set<SpeedController> generate(Simulation sim, TrainSchedule schedule, Set<SpeedController> speedControllers) {
        this.sim = sim;
        double beginPosition = findPhaseInitialLocation(schedule);
        double endPosition = findPhaseEndLocation(schedule);
        var initialSpeeds = getExpectedSpeeds(sim, schedule, speedControllers, 1,
                beginPosition, endPosition, schedule.initialSpeed);
        initialSpeed = Interpolation.interpolate(initialSpeeds, beginPosition);
        this.schedule = schedule;
        this.maxSpeedControllers = speedControllers;
        return binarySearch(sim, schedule);
    }

    /** Evaluates the run time of the phase if we follow the given speed controllers */
    protected double evalRunTime(Simulation sim, TrainSchedule schedule, Set<SpeedController> speedControllers) {
        expectedTimes = getExpectedTimes(sim, schedule, speedControllers, 1,
                findPhaseInitialLocation(schedule), findPhaseEndLocation(schedule), initialSpeed);
        return expectedTimes.lastEntry().getValue() - expectedTimes.firstEntry().getValue();
    }

    /** Gives the target run time for the phase, given the one if we follow max speeds */
    protected abstract double getTargetTime(double baseTime);

    /** Returns the first lower bound for the dichotomy */
    protected abstract double getFirstLowEstimate();

    /** Returns the first higher bound for the dichotomy */
    protected abstract double getFirstHighEstimate();

    /** Generates a set of speed controllers given the dichotomy value */
    protected abstract Set<SpeedController> getSpeedControllers(TrainSchedule schedule, double value);

    /** Runs the dichotomy */
    private Set<SpeedController> binarySearch(Simulation sim, TrainSchedule schedule) {
        var lowerBound = getFirstLowEstimate();
        var higherBound = getFirstHighEstimate();
        // marche de base
        var time = evalRunTime(sim, schedule, maxSpeedControllers);
        var targetTime = getTargetTime(time);
        var beginLocation = findPhaseInitialLocation(schedule);
        var endLocation = findPhaseEndLocation(schedule);

        double nextValue;
        Set<SpeedController> nextSpeedControllers;
        int i = 0;
        do {
            nextValue = (lowerBound + higherBound) / 2;
            nextSpeedControllers = getSpeedControllers(schedule, nextValue);
            var expectedTimes = getExpectedTimes(sim, schedule,
                    nextSpeedControllers, 1, beginLocation, endLocation, initialSpeed);
            time = expectedTimes.lastEntry().getValue() - expectedTimes.firstEntry().getValue();
            if (time > targetTime)
                lowerBound = nextValue;
            else
                higherBound = nextValue;
            // saveGraph(nextSpeedControllers, sim, schedule, "speeds-" + i + ".csv");
            if (i++ > 20)
                throw new RuntimeException("Did not converge");
        } while( Math.abs(time - targetTime) > precision);
        return nextSpeedControllers;
    }

    /** Saves a speed / position graph, for debugging purpose */
    public void saveGraph(Set<SpeedController> speedControllers, Simulation sim, TrainSchedule schedule, String path) {
        try {
            PrintWriter writer = null;
            writer = new PrintWriter(path, "UTF-8");
            writer.println("position,speed");
            var expectedSpeeds = getExpectedSpeeds(sim, schedule, speedControllers, 0.01);
            for (var entry : expectedSpeeds.entrySet()) {
                writer.println(String.format("%f,%f", entry.getKey(), entry.getValue()));
            }
            writer.close();
        } catch (FileNotFoundException | UnsupportedEncodingException e) {
            e.printStackTrace();
        }
    }
}
