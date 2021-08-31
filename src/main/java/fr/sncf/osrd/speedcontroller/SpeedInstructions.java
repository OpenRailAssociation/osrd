package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.generators.MaxSpeedGenerator;
import fr.sncf.osrd.speedcontroller.generators.SpeedControllerGenerator;
import fr.sncf.osrd.utils.SortedDoubleMap;

import java.util.*;

/** Contains all the pre-computed speed controller and indications.
 * For now it contains data about target speed (with margin or mareco), and max speed for when the train is
 * running late. It also contains the expected time at each point to know if we're running late.
 * Later on, we may add other indications such as when to coast. */
public class SpeedInstructions {

    /** Generator for the target speeds
     * Each set is applied one after the other, using the previous result as base speed.
     * The generators in a set are applied independently */
    public final transient List<Set<SpeedControllerGenerator>> targetSpeedGenerators;

    /** Set of speed controllers indicating the maximum speed at each point */
    public Set<SpeedController> maxSpeedControllers;

    /** Set of speed controllers indicating the target speed at each point */
    public Set<SpeedController> targetSpeedControllers;
    public transient SortedDoubleMap expectedTimes = null;

    /** Creates an instance from target speed generators. Max speed is always determined
     * from a `new MaxSpeedGenerator()`.
     * @param targetSpeedGenerators generators used for target speed controllers. If null, a MaxSpeedGenerator is
     *      used instead. When given several generators, those in a set are computed independently,
     *      then each set is computed sequentially using the previous one as reference speed. */
    public SpeedInstructions(List<Set<SpeedControllerGenerator>> targetSpeedGenerators) {
        if (targetSpeedGenerators == null || targetSpeedGenerators.size() == 0)
            targetSpeedGenerators = Collections.singletonList(Collections.singleton(new MaxSpeedGenerator()));
        this.targetSpeedGenerators = targetSpeedGenerators;
    }

    /** Creates an instance from a list of generators. They are evaluated sequentially using the previous
     * one as reference. */
    public static SpeedInstructions fromList(List<SpeedControllerGenerator> targetSpeedGenerators) {
        var listOfSet = new ArrayList<Set<SpeedControllerGenerator>>();
        for (var generator : targetSpeedGenerators)
            listOfSet.add(Collections.singleton(generator));
        return new SpeedInstructions(listOfSet);
    }

    /** Creates an instance from a set of generators. They are evaluated independently. */
    public static SpeedInstructions fromSet(Set<SpeedControllerGenerator> targetSpeedGenerators) {
        var listOfSet = new ArrayList<Set<SpeedControllerGenerator>>();
        listOfSet.add(targetSpeedGenerators);
        return new SpeedInstructions(listOfSet);
    }

    /** Creates an instance from a set of generators. They are evaluated independently. */
    public static SpeedInstructions fromController(SpeedControllerGenerator targetSpeedGenerator) {
        return fromSet(Collections.singleton(targetSpeedGenerator));
    }

    /** Generates all the instructions, expected to be called when the train is created in the simulation */
    public void generate(Simulation sim, TrainSchedule schedule) {
        maxSpeedControllers = new MaxSpeedGenerator().generate(sim, schedule, null);
        targetSpeedControllers = new HashSet<>(maxSpeedControllers);
        for (var generatorSet : targetSpeedGenerators) {
            var newControllers = new HashSet<SpeedController>();
            for (var generator : generatorSet) {
                newControllers.addAll(generator.generate(sim, schedule, targetSpeedControllers));
            }
            targetSpeedControllers.addAll(newControllers);
        }

        expectedTimes = SpeedControllerGenerator.getExpectedTimes(sim, schedule, targetSpeedControllers,
                SpeedControllerGenerator.TIME_STEP, 0, Double.POSITIVE_INFINITY, schedule.initialSpeed);
    }

    /** Returns how late we are compared to the expected time, in seconds. The result may be negative if we are
     * ahead of schedule. */
    public double secondsLate(double position, double time) {
        assert expectedTimes != null;
        var expectedTime = expectedTimes.interpolate(position);
        return time - expectedTime;
    }

    @Override
    public String toString() {
        var res = new StringBuilder();
        res.append("max speed controllers: {");
        for (var controller: maxSpeedControllers) {
            res.append(controller);
            res.append(", ");
        }
        res.append("}, target speed controllers: {");
        for (var controller: targetSpeedControllers) {
            res.append(controller);
            res.append(", ");
        }
        res.append("}");
        return res.toString();
    }
}
