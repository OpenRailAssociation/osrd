package fr.sncf.osrd.speedcontroller.generators;

import static java.util.Collections.max;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.LimitAnnounceSpeedController;
import fr.sncf.osrd.speedcontroller.MapSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPhysicsIntegrator;
import fr.sncf.osrd.train.TrainPositionTracker;
import fr.sncf.osrd.train.TrainSchedule;
import java.util.HashSet;
import java.util.Set;

/** Adds a construction margin to the given speed limits
 * The allowanceValue is in seconds, added over the whole phase */
public class ConstructionAllowanceGenerator extends DichotomyControllerGenerator {

    public final double value;

    public ConstructionAllowanceGenerator(double begin, double end,
                                          double allowanceValue) {
        super(begin, end, 0.1);
        this.value = allowanceValue;
    }

    @Override
    protected double getTargetTime(double baseTime) {
        return baseTime + value;
    }

    @Override
    protected double getFirstLowEstimate() {
        return 0;
    }

    @Override
    protected double getFirstHighEstimate() {
        var speeds = getExpectedSpeeds(sim, schedule, maxSpeedControllers, TIME_STEP);
        return max(speeds.values());
    }

    @Override
    protected double getFirstGuess() {
        return ((this.getFirstHighEstimate() + this.getFirstLowEstimate()) / 2);
    }

    private static TrainPositionTracker convertPosition(TrainSchedule schedule, Simulation sim, double position) {
        var location = Train.getInitialLocation(schedule, sim);
        location.updatePosition(schedule.rollingStock.length, position);
        return location;
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
        // TODO: adapt this to non-constant deceleration
        var requiredBrakingDistance = Double.max(0,
                (initialSpeed * initialSpeed - targetSpeed * targetSpeed) / 2 * schedule.rollingStock.gamma);
        var endBrakingPosition = initialPosition + requiredBrakingDistance;
        // running calculation starting where the braking ends, to create a scaled MapSpeedController from it
        var roiSpeeds = getExpectedSpeeds(sim, schedule, currentSpeedControllers, TIME_STEP,
                endBrakingPosition, endPosition, initialSpeed);
        double maxSpeed = max(roiSpeeds.values());
        double scaleFactor = targetSpeed / maxSpeed;

        currentSpeedControllers.add(new MapSpeedController(roiSpeeds).scaled(scaleFactor));

        LimitAnnounceSpeedController brakingSpeedController = LimitAnnounceSpeedController.create(
                initialSpeed,
                initialSpeed * scaleFactor,
                endBrakingPosition,
                schedule.rollingStock.gamma
        );
        currentSpeedControllers.add(brakingSpeedController);

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
            var action = Action.accelerate(-schedule.rollingStock.getMaxEffort(speed));
            var update =  integrator.computeUpdate(action, location.getPathPosition(), -1);
            speed = update.speed;

            // We cannot just call updatePosition with a negative delta so we re-create the location object
            // TODO (optimization): support negative delta
            location = convertPosition(schedule, sim, location.getPathPosition() - update.positionDelta);
        }

        var res = new HashSet<>(maxSpeedControllers);
        var initialSpeedControllers = new HashSet<>(maxSpeedControllers);

        res.add(brakingSpeedController);

        // scaled MapSpeedControllers only between the end of the braking phase and the beginning of the acceleration
        var speedsEndingEarlier = getExpectedSpeeds(sim, schedule, initialSpeedControllers, TIME_STEP,
                endBrakingPosition, location.getPathPosition(), initialSpeed);
        res.add(new MapSpeedController(speedsEndingEarlier).scaled(scaleFactor));

        return res;
    }
}