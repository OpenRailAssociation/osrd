package fr.sncf.osrd.speedcontroller.generators;


import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.MarginType;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.utils.SortedDoubleMap;
import java.io.FileNotFoundException;
import java.io.PrintWriter;
import java.io.UnsupportedEncodingException;
import java.util.Set;

/** Generates a set of speed controller using a generic dichotomy */
public abstract class DichotomyControllerGenerator extends SpeedControllerGenerator {
    /** We stop the dichotomy when the result is this close to the target (in seconds) */
    private final double precision;

    /** Set of speed controllers describing the max speed */
    protected Set<SpeedController> maxSpeedControllers;

    /** Train schedule */
    protected TrainSchedule schedule = null;

    /** Expected times from previous evaluation */
    protected SortedDoubleMap expectedTimes;

    protected static final double DICHOTOMY_MARGIN = 2;

    public final MarginType allowanceType;
    public final double value;

    /** Constructor
     * @param precision how close we need to be to the target time (in seconds)
     */
    protected DichotomyControllerGenerator(double begin, double end, double precision,
                                           MarginType allowanceType, double value) {
        super(begin, end);
        this.precision = precision;
        this.allowanceType = allowanceType;
        this.value = value;
    }

    /** Generates a set of speed controller using dichotomy */
    @Override
    public Set<SpeedController> generate(Simulation sim, TrainSchedule schedule,
                                         Set<SpeedController> maxSpeeds) throws SimulationError {
        sectionEnd = Double.min(sectionEnd, schedule.plannedPath.length);
        this.schedule = schedule;
        this.maxSpeedControllers = maxSpeeds;
        return binarySearch(sim, schedule);
    }

    /** Evaluates the run time of the phase if we follow the given speed controllers */
    protected double evalRunTime(TrainSchedule schedule, Set<SpeedController> speedControllers) {
        expectedTimes = getExpectedTimes(schedule, speedControllers, TIME_STEP, false);
        return expectedTimes.lastEntry().getValue() - expectedTimes.firstEntry().getValue();
    }

    /** Gives the target run time for the phase, given the one if we follow max speeds */
    protected final double getTargetTime(double baseTime, double totalDistance) {
        if (allowanceType.equals(MarginType.TIME))
            return baseTime + value;
        else if (allowanceType.equals(MarginType.PERCENTAGE))
            return baseTime * (1 + value / 100);
        else {
            var n = totalDistance / 100000; // number of portions of 100km in the train journey
            var totalAllowance = value * n * 60;
            return baseTime + totalAllowance;
        }
    }

    /** Returns the first lower bound for the dichotomy */
    protected abstract double getFirstLowEstimate();

    /** Returns the first higher bound for the dichotomy */
    protected abstract double getFirstHighEstimate(SortedDoubleMap speeds);

    /** Returns the first guess for the dichotomy */
    protected abstract double getFirstGuess(SortedDoubleMap speeds);

    /** Generates a set of speed controllers given the dichotomy value */
    protected abstract Set<SpeedController> getSpeedControllers(TrainSchedule schedule,
                                                                double value) throws SimulationError;

    /** Generates a set of speed controllers given the dichotomy value,
     *  with specified begin and end position */
    protected abstract Set<SpeedController> getSpeedControllers(TrainSchedule schedule,
                                                                double value,
                                                                double begin,
                                                                double end) throws SimulationError;

    /** initialize some variables before running the dichotomy process */
    protected abstract void initializeBinarySearch(TrainSchedule schedule,
                                                              SortedDoubleMap speeds);

    /** compute the braking distance from initialSpeed to a given target speed */
    protected abstract double computeBrakingDistance(double initialPosition,
                                                     double endPosition, double initialSpeed, double targetSpeed,
                                                     TrainSchedule schedule);

    /** Runs the dichotomy */
    private Set<SpeedController> binarySearch(Simulation sim, TrainSchedule schedule) throws SimulationError {

        var speeds = getExpectedSpeeds(schedule, maxSpeedControllers, TIME_STEP);
        var lowerBound = getFirstLowEstimate();
        var higherBound = getFirstHighEstimate(speeds);
        var firstGuess = getFirstGuess(speeds);
        initializeBinarySearch(schedule, speeds);

        // base run
        var times = getExpectedTimes(schedule, maxSpeedControllers, TIME_STEP, false);
        var time = times.lastEntry().getValue() - times.firstEntry().getValue();
        var distance = times.lastEntry().getKey() - times.firstEntry().getKey();
        var targetTime = getTargetTime(time, distance);

        double nextValue = firstGuess;
        var nextSpeedControllers = maxSpeedControllers;
        int i = 0;
        while (Math.abs(time - targetTime) > precision) {
            nextSpeedControllers = getSpeedControllers(schedule, nextValue);
            time = evalRunTime(schedule, nextSpeedControllers);
            if (time > targetTime)
                lowerBound = nextValue;
            else
                higherBound = nextValue;
            nextValue = (lowerBound + higherBound) / 2;
            if (i++ > 20)
                throw new RuntimeException("Did not converge");
        }
        return nextSpeedControllers;
    }

    /** Saves a speed / position graph, for debugging purpose */
    public void saveGraph(Set<SpeedController> speedControllers, Simulation sim, TrainSchedule schedule, String path) {
        try {
            PrintWriter writer = new PrintWriter(path, "UTF-8");
            writer.println("position;speed");
            var expectedSpeeds = getExpectedSpeeds(schedule, speedControllers, TIME_STEP);
            for (var entry : expectedSpeeds.entrySet()) {
                writer.println(String.format("%f;%f", entry.getKey(), entry.getValue()));
            }
            writer.close();
        } catch (FileNotFoundException | UnsupportedEncodingException e) {
            e.printStackTrace();
        }
    }
}
