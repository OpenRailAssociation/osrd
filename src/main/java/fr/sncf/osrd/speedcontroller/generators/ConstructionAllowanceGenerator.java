package fr.sncf.osrd.speedcontroller.generators;

import static java.lang.Math.min;
import static java.util.Collections.max;
import static java.util.Collections.replaceAll;

import fr.sncf.osrd.RollingStock;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.LimitAnnounceSpeedController;
import fr.sncf.osrd.speedcontroller.MapSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.speedcontroller.SpeedDirective;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPhysicsIntegrator;
import fr.sncf.osrd.train.TrainPositionTracker;
import fr.sncf.osrd.train.TrainPhysicsIntegrator.PositionUpdate;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.utils.SortedDoubleMap;

import java.util.HashSet;
import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;

/** Adds a construction margin to the given speed limits
 * The allowanceValue is in seconds, added over the whole phase */
public class ConstructionAllowanceGenerator extends DichotomyControllerGenerator {

    public final double value;

    public ConstructionAllowanceGenerator(double begin, double end,
                                          double allowanceValue) {
        super(begin, end, 5 * TIME_STEP);
        this.value = allowanceValue;
    }

    @Override
    protected double getTargetTime(double baseTime) {
        return baseTime + value;
    }

    @Override
    protected double getFirstLowEstimate() {
        return 0.0;
    }

    @Override
    protected double getFirstHighEstimate() {
        var speeds = getExpectedSpeeds(sim, schedule, maxSpeedControllers, TIME_STEP);
        return max(speeds.values());
    }

    @Override
    protected double getFirstGuess() {
        // first guess will be underestimated on purpose to make the dichotomy run in a smaller interval
        // lowering it twice compared to its approximate value
        // keeping getFirstLowEstimate() at 0.0 prevents mistakes
        var time = evalRunTime(sim, schedule, maxSpeedControllers);
        return ((this.getFirstHighEstimate() - this.getFirstLowEstimate()) * time / (time + 2 * value));
    }

    @Override
    protected Set<SpeedController> getSpeedControllers(TrainSchedule schedule,
                                                       double targetSpeed,
                                                       double initialPosition,
                                                       double endPosition) {

        var currentSpeedControllers = new HashSet<>(maxSpeedControllers);
        // running calculation to get the initial speed of the Region Of Interest (ROI)
        var expectedSpeeds = getExpectedSpeeds(sim, schedule, currentSpeedControllers, TIME_STEP,
                0, initialPosition, schedule.initialSpeed);
        var initialSpeed = expectedSpeeds.interpolate(initialPosition);
        var requiredBrakingDistance = Double.max(0,
                computeBrakingDistance(initialPosition, endPosition, initialSpeed, targetSpeed, schedule));

        var endBrakingPosition = initialPosition + requiredBrakingDistance;
        // running calculation starting where the braking ends, to create a scaled MapSpeedController from it
        var roiSpeeds = getExpectedSpeeds(sim, schedule, currentSpeedControllers, TIME_STEP,
                endBrakingPosition, endPosition, initialSpeed);
        double maxSpeed = max(roiSpeeds.values());
        double scaleFactor = targetSpeed / maxSpeed;

        currentSpeedControllers.add(new MapSpeedController(roiSpeeds).scaled(scaleFactor));

        var res = new HashSet<>(maxSpeedControllers);

        if (endBrakingPosition != initialPosition) {
            LimitAnnounceSpeedController brakingSpeedController = new LimitAnnounceSpeedController(
                    initialSpeed * scaleFactor,
                    initialPosition,
                    endBrakingPosition,
                    schedule.rollingStock.gamma
            );
            currentSpeedControllers.add(brakingSpeedController);
            res.add(brakingSpeedController);
        }

        // new running calculation with brakingSpeedController + scaled MapSpeedController
        // now only the re-acceleration phase is missing
        var newSpeeds = getExpectedSpeeds(sim, schedule, currentSpeedControllers, TIME_STEP,
                initialPosition, endPosition, initialSpeed);

        // backwards acceleration calculation
        double speed = roiSpeeds.interpolate(endPosition);

        var location = convertPosition(schedule, sim, endPosition);

        while (speed > newSpeeds.interpolate(location.getPathPosition()) && location.getPathPosition() > 0.) {
            var integrator = TrainPhysicsIntegrator.make(TIME_STEP, schedule.rollingStock,
                    speed, location.meanTrainGrade());
            var directive = new SpeedDirective(newSpeeds.interpolate(location.getPathPosition()));
            var action = integrator.actionToTargetSpeed(directive, schedule.rollingStock, -1);
            var update = integrator.computeUpdate(action, location.getPathPosition(), -1);
            speed = update.speed;
            location.updatePosition(schedule.rollingStock.length, update.positionDelta);
        }

        var initialSpeedControllers = new HashSet<>(maxSpeedControllers);

        // scaled MapSpeedControllers only between the end of the braking phase and the beginning of the acceleration
        var speedsEndingEarlier = getExpectedSpeeds(sim, schedule, initialSpeedControllers, TIME_STEP,
                endBrakingPosition, location.getPathPosition(), initialSpeed);
        speedsEndingEarlier.put(endBrakingPosition, targetSpeed); // add first point to the future MapSpeedController
        res.add(new MapSpeedController(speedsEndingEarlier).scaled(scaleFactor));

        return res;
    }

}
