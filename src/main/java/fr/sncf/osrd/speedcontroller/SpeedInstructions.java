package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.TrainSchedule;
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

    /** Generator for the target speeds */
    public final transient List<SpeedControllerGenerator> targetSpeedGenerators;

    /** Set of speed controllers indicating the maximum speed at each point */
    public Set<SpeedController> maxSpeedControllers;

    /** Set of speed controllers indicating the target speed at each point */
    public Set<SpeedController> targetSpeedControllers;
    public transient SortedDoubleMap expectedTimes;

    /** Creates an instance from a target speed generator. Max speed is always determined
     * from a `new MaxSpeedGenerator()`.
     * @param targetSpeedGenerators generators used for target speed controllers. If null, a MaxSpeedGenerator is
     *      used instead. If several controllers are given, we give the result of the previous one as reference. */
    public SpeedInstructions(List<SpeedControllerGenerator> targetSpeedGenerators) {
        if (targetSpeedGenerators == null || targetSpeedGenerators.size() == 0)
            targetSpeedGenerators = Collections.singletonList(new MaxSpeedGenerator());
        this.targetSpeedGenerators = targetSpeedGenerators;
    }

    /** Generates all the instructions, expected to be called when a new phase starts */
    public void generate(Simulation sim, TrainSchedule schedule) {
        double initialSpeed = schedule.initialSpeed;
        double previousDelay = 0;
        double initialPosition = 0;
        var train = sim.trains.get(schedule.trainID);
        if (train != null) {
            var state = train.getLastState();
            initialSpeed = state.speed;
            previousDelay = state.currentPhaseState.speedInstructions
                    .secondsLate(state.location.getPathPosition(), sim.getTime());
            initialPosition = state.location.getPathPosition();
        }


        maxSpeedControllers = new MaxSpeedGenerator().generate(sim, schedule, null, 0);
        targetSpeedControllers = maxSpeedControllers;
        for (var generator : targetSpeedGenerators)
            targetSpeedControllers = generator.generate(sim, schedule, targetSpeedControllers, initialSpeed);
        targetSpeedControllers.addAll(maxSpeedControllers);

        var lastGenerator = targetSpeedGenerators.get(targetSpeedGenerators.size() - 1);
        expectedTimes = lastGenerator.getExpectedTimes(sim, schedule, targetSpeedControllers, 1,
                initialPosition, Double.POSITIVE_INFINITY, initialSpeed);
        for (var k : expectedTimes.keySet()) {
            expectedTimes.put(k, expectedTimes.get(k) - previousDelay + sim.getTime());
        }
    }

    /** Copy constructor */
    public SpeedInstructions(SpeedInstructions other) {
        this.maxSpeedControllers = new HashSet<>(other.maxSpeedControllers);
        this.targetSpeedControllers = new HashSet<>(other.targetSpeedControllers);
        this.expectedTimes = new SortedDoubleMap(other.expectedTimes);
        targetSpeedGenerators = new ArrayList<>(other.targetSpeedGenerators);
    }

    /** Returns how late we are compared to the expected time, in seconds. The result may be negative if we are
     * ahead of schedule. */
    public double secondsLate(double position, double time) {
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
