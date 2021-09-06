package fr.sncf.osrd.speedcontroller.generators;

import static java.lang.Math.min;

import fr.sncf.osrd.RollingStock;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.TrainPhysicsIntegrator;
import fr.sncf.osrd.train.TrainPhysicsIntegrator.PositionUpdate;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.utils.SortedDoubleMap;
import java.io.FileNotFoundException;
import java.io.PrintWriter;
import java.io.UnsupportedEncodingException;
import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;

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
                                         Set<SpeedController> maxSpeeds) {
        sectionEnd = Double.min(sectionEnd, schedule.plannedPath.length);
        this.sim = sim;
        this.schedule = schedule;
        this.maxSpeedControllers = maxSpeeds;
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

    /** compute the braking distance from (initialPosition, initialSpeed) to a given target speed */
    public double computeBrakingDistance(double initialPosition, double endPosition,
                                          double initialSpeed, double targetSpeed, TrainSchedule schedule) {

        if (schedule.rollingStock.gammaType == RollingStock.GammaType.CONST)
            return (initialSpeed * initialSpeed - targetSpeed * targetSpeed) / (2 * schedule.rollingStock.gamma);

        var res = getUpdatesAtPositionsToTarget(sim, schedule,
                initialPosition, initialSpeed, endPosition, targetSpeed);
        return res.lastKey() - res.firstKey();
    }

    private NavigableMap<Double, PositionUpdate> getUpdatesAtPositionsToTarget(Simulation sim,
                                                                               TrainSchedule schedule,
                                                                               double initialPosition,
                                                                               double initialSpeed,
                                                                               double endPosition,
                                                                               double targetSpeed) {

        var res = new TreeMap<Double, TrainPhysicsIntegrator.PositionUpdate>();
        var stopIndex = 0;
        var location = convertPosition(schedule, sim, initialPosition);
        var totalLength = 0.;
        for (var range : schedule.plannedPath.trackSectionPath)
            totalLength += range.length();
        totalLength = min(totalLength, endPosition);
        double speed = initialSpeed;

        do {
            var integrator = TrainPhysicsIntegrator.make(TIME_STEP, schedule.rollingStock,
                    speed, location.meanTrainGrade());
            var inertia = schedule.rollingStock.mass * schedule.rollingStock.inertiaCoefficient;
            var action = Action.brake(schedule.rollingStock.gamma * inertia);
            var distanceLeft = min(totalLength - location.getPathPosition(), endPosition - location.getPathPosition());
            var update = integrator.computeUpdate(action, distanceLeft);
            speed = update.speed;

            location.updatePosition(schedule.rollingStock.length, update.positionDelta);
            res.put(location.getPathPosition(), update);
            if (speed <= 0) {
                stopIndex++;
                if (stopIndex >= schedule.stops.size())
                    break;
            }
        } while (speed > targetSpeed && location.getPathPosition() + TIME_STEP * speed < totalLength);
        return res;
    }
}
