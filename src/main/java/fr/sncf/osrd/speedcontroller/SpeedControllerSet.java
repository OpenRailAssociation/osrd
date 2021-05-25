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
 * For now it contains data about desired speed (with margin or mareco), and max speed for when the train is
 * running late. Later on, we may add other indications such as when to coast. */
public class SpeedControllerSet {
    public final Set<SpeedController> maxSpeedControllers;
    public final Set<SpeedController> desiredSpeedControllers;
    public transient final NavigableMap<Double, Double> expectedTimes;

    /** Generates the base speed controllers, where desired speed = max speed
     * @param schedule train schedule */
    public SpeedControllerSet(Simulation sim, TrainSchedule schedule) {
        this(sim, schedule, new MaxSpeedGenerator());
    }

    /** Generates the desired speed controllers from the given generators. Max speed is always determined
     * from a `new MaxSpeedGenerator`.
     * @param schedule train schedule
     * @param desiredSpeedGenerator generator used for desired speed controllers */
    public SpeedControllerSet(Simulation sim, TrainSchedule schedule, SpeedControllerGenerator desiredSpeedGenerator) {
        maxSpeedControllers = new MaxSpeedGenerator().generate(schedule);
        desiredSpeedControllers = desiredSpeedGenerator.generate(schedule);
        expectedTimes = desiredSpeedGenerator.getExpectedTimes(sim, schedule, desiredSpeedControllers, 1);
    }

    /** Copy constructor */
    public SpeedControllerSet(SpeedControllerSet other) {
        this.maxSpeedControllers = new HashSet<>(other.maxSpeedControllers);
        this.desiredSpeedControllers = new HashSet<>(other.desiredSpeedControllers);
        this.expectedTimes = new TreeMap<>(other.expectedTimes);
    }

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
        System.out.println(time + " " + timeBefore);
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
        res.append("}, desired speed controllers: {");
        for (var controller: desiredSpeedControllers) {
            res.append(controller);
            res.append(", ");
        }
        res.append("}");
        return res.toString();
    }
}
