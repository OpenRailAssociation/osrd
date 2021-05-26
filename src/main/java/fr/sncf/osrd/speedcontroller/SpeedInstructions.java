package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.generators.MaxSpeedGenerator;
import fr.sncf.osrd.speedcontroller.generators.SpeedControllerGenerator;

import java.util.HashSet;
import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;

/** Contains all the pre-computed speed controller and indications.
 * For now it contains data about target speed (with margin or mareco), and max speed for when the train is
 * running late. It also contains the expected time at each point to know if we're running late.
 * Later on, we may add other indications such as when to coast. */
public class SpeedInstructions {

    /** Generator for the target speeds */
    public final transient SpeedControllerGenerator targetSpeedGenerator;

    /** Set of speed controllers indicating the maximum speed at each point */
    public Set<SpeedController> maxSpeedControllers;

    /** Set of speed controllers indicating the target speed at each point */
    public Set<SpeedController> targetSpeedControllers;
    public transient NavigableMap<Double, Double> expectedTimes;

    /** Creates an instance from a target speed generator. Max speed is always determined
     * from a `new MaxSpeedGenerator()`.
     * @param targetSpeedGenerator generator used for target speed controllers. If null, a MaxSpeedGenerator is
     *      used instead. */
    public SpeedInstructions(SpeedControllerGenerator targetSpeedGenerator) {
        if (targetSpeedGenerator == null)
            targetSpeedGenerator = new MaxSpeedGenerator();
        this.targetSpeedGenerator = targetSpeedGenerator;
    }

    /** Generates all the instructions, expected to be called when a new phase starts */
    public void generate(Simulation sim, TrainSchedule schedule) {
        maxSpeedControllers = new MaxSpeedGenerator().generate(schedule, null);
        targetSpeedControllers = targetSpeedGenerator.generate(schedule, maxSpeedControllers);
        targetSpeedControllers.addAll(maxSpeedControllers);
        expectedTimes = targetSpeedGenerator.getExpectedTimes(sim, schedule, targetSpeedControllers, 1);
    }

    /** Copy constructor */
    public SpeedInstructions(SpeedInstructions other) {
        this.maxSpeedControllers = new HashSet<>(other.maxSpeedControllers);
        this.targetSpeedControllers = new HashSet<>(other.targetSpeedControllers);
        this.expectedTimes = new TreeMap<>(other.expectedTimes);
        this.targetSpeedGenerator = other.targetSpeedGenerator;
    }

    /** Returns how late we are compared to the expected time, in seconds. The result may be negative if we are
     * ahead of schedule. */
    public double secondsLate(double position, double time) {
        var entryBefore = expectedTimes.floorEntry(position);
        var entryAfter = expectedTimes.ceilingEntry(position);
        if (entryBefore == null)
            entryBefore = entryAfter;
        if (entryAfter == null)
            entryAfter = entryBefore;
        if (entryAfter == null)
            throw new RuntimeException("Missing pre-computed expected times");
        var timeBefore = entryBefore.getValue();
        var positionBefore = entryBefore.getKey();
        var timeAfter = entryAfter.getValue();
        var positionAfter = entryAfter.getKey();
        if (Math.abs(positionAfter - positionBefore) < 1e-5)
            return time - timeBefore;
        var slope = (timeAfter - timeBefore) / (positionAfter - positionBefore);
        var expectedTime = timeBefore + (position - positionBefore) * slope;
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
