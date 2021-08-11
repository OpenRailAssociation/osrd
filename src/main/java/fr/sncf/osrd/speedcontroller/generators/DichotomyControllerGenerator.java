package fr.sncf.osrd.speedcontroller.generators;

import fr.sncf.osrd.simulation.Simulation;
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

    /** Simulation state given in `generate` parameters */
    protected Simulation sim;

    /** Constructor
     * @param precision how close we need to be to the target time (in seconds) */
    protected DichotomyControllerGenerator(double begin, double end, double precision) {
        super(begin, end);
        this.precision = precision;
    }

    /** Generates a set of speed controller using dichotomy */
    @Override
    public Set<SpeedController> generate(Simulation sim, TrainSchedule schedule,
                                         Set<SpeedController> speedControllers) {
        sectionEnd = Double.min(sectionEnd, schedule.plannedPath.length);
        this.sim = sim;
        this.schedule = schedule;
        this.maxSpeedControllers = speedControllers;
        return binarySearch(sim, schedule);
    }

    /** Evaluates the run time of the phase if we follow the given speed controllers */
    protected double evalRunTime(Simulation sim, TrainSchedule schedule, Set<SpeedController> speedControllers) {
        expectedTimes = getExpectedTimes(sim, schedule, speedControllers, TIME_STEP);
        return expectedTimes.lastEntry().getValue() - expectedTimes.firstEntry().getValue();
    }

    /** Gives the target run time for the phase, given the one if we follow max speeds */
    protected abstract double getTargetTime(double baseTime);

    /** Returns the first lower bound for the dichotomy */
    protected abstract double getFirstLowEstimate();

    /** Returns the first higher bound for the dichotomy */
    protected abstract double getFirstHighEstimate();

    /** Returns the first guess for the dichotomy */
    protected abstract double getFirstGuess();

    /** Generates a set of speed controllers given the dichotomy value */
    protected abstract Set<SpeedController> getSpeedControllers(TrainSchedule schedule,
                                                                double value, double begin, double end);

    /** Runs the dichotomy */
    private Set<SpeedController> binarySearch(Simulation sim, TrainSchedule schedule) {
        var lowerBound = getFirstLowEstimate();
        var higherBound = getFirstHighEstimate();
        var firstGuess = getFirstGuess();

        // marche de base
        // the binary search condition should be on the total time
        var time = evalRunTime(sim, schedule, maxSpeedControllers);
        var targetTime = getTargetTime(time);

        double nextValue = firstGuess;
        Set<SpeedController> nextSpeedControllers;
        int i = 0;
        do {
            nextSpeedControllers = getSpeedControllers(schedule, nextValue, sectionBegin, sectionEnd);
            time = evalRunTime(sim, schedule, nextSpeedControllers);
            if (time > targetTime)
                lowerBound = nextValue;
            else
                higherBound = nextValue;
            nextValue = (lowerBound + higherBound) / 2;
            if (i++ > 20)
                throw new RuntimeException("Did not converge");
            saveGraph(nextSpeedControllers, sim, schedule,
                    "C:\\Users\\9706809E\\OneDrive - SNCF\\Documents\\Physique\\Affichage_courbes\\graph"+i+".csv");
        } while (Math.abs(time - targetTime) > precision);
        return nextSpeedControllers;
    }

    /** Saves a speed / position graph, for debugging purpose */
    public void saveGraph(Set<SpeedController> speedControllers, Simulation sim, TrainSchedule schedule, String path) {
        try {
            PrintWriter writer = new PrintWriter(path, "UTF-8");
            writer.println("position;speed");
            var expectedSpeeds = getExpectedSpeeds(sim, schedule, speedControllers, TIME_STEP);
            for (var entry : expectedSpeeds.entrySet()) {
                writer.println(String.format("%f;%f", entry.getKey(), entry.getValue()));
            }
            writer.close();
        } catch (FileNotFoundException | UnsupportedEncodingException e) {
            e.printStackTrace();
        }
    }
}
