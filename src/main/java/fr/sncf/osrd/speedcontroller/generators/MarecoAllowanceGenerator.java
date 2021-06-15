package fr.sncf.osrd.speedcontroller.generators;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.MarecoAllowance.MarginType;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPhase;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.CoastingSpeedController;
import fr.sncf.osrd.speedcontroller.LimitAnnounceSpeedController;
import fr.sncf.osrd.speedcontroller.MaxSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPhysicsIntegrator;
import fr.sncf.osrd.train.TrainPositionTracker;
import fr.sncf.osrd.utils.Interpolation;

import java.util.*;
import java.util.stream.Collectors;

import static fr.sncf.osrd.utils.Interpolation.interpolate;
import static java.lang.Math.min;

public class MarecoAllowanceGenerator extends DichotomyControllerGenerator {

    private final RJSAllowance.MarecoAllowance.MarginType allowanceType;
    private final double value;

    public MarecoAllowanceGenerator(double allowanceValue, MarginType allowanceType, RJSTrainPhase phase) {
        super(phase, 0.5);
        this.allowanceType = allowanceType;
        this.value = allowanceValue;
    }

    @Override
    protected double getTargetTime(double baseTime) {
        return baseTime * (1 + value / 100);
    }

    @Override
    protected double getFirstLowEstimate() {
        return 0;
    }

    @Override
    protected double getFirstHighEstimate() {
        double max = 0;
        double position = findPhaseInitialLocation(schedule);
        double endLocation = findPhaseEndLocation(schedule);
        while (position < endLocation) {
            double val = SpeedController.getDirective(maxSpeedControllers, position).allowedSpeed;
            if (val > max)
                max = val;
            position += 1;
        }
        // TODO find better way to define it
        return max*10;
    }

    private List<Double> findPositionSameSpeedAsVF(NavigableMap<Double, Double> speeds, double vf) {
        // TODO check only in deceleration intervals
        boolean isLastSpeedBelowVF = true;
        var res = new ArrayList<Double>();
        for (var position : speeds.navigableKeySet()) {
            var speed = speeds.get(position);
            boolean isCurrentSpeedBelowVF = speed < vf;
            if (isCurrentSpeedBelowVF && !isLastSpeedBelowVF && isDecelerating(position)) {
                res.add(position);
            }
            isLastSpeedBelowVF = isCurrentSpeedBelowVF;
        }
        return res;
    }

    private List<Double> findDecelerationPhases(double vf) {
        var res = new ArrayList<Double>();
        for (var announcer : findLimitSpeedAnnouncers(maxSpeedControllers)) {
            if (announcer.targetSpeedLimit > vf)
                res.add(announcer.endPosition);
        }
        return res;
    }

    private static TrainPositionTracker convertPosition(TrainSchedule schedule, Simulation sim, double position) {
        var location = Train.getInitialLocation(schedule, sim);
        location.updatePosition(schedule.rollingStock.length, position);
        return location;
    }

    private CoastingSpeedController generateCoastingSpeedControllerAtPosition(NavigableMap<Double, Double> speeds,
                                                                              double endLocation, double timestep) {
        double speed = interpolate(speeds, endLocation);

        var location = convertPosition(schedule, sim, endLocation);

        do {
            var integrator = TrainPhysicsIntegrator.make(timestep, schedule.rollingStock,
                    speed, location.maxTrainGrade());
            var action = Action.coast();
            var update =  integrator.computeUpdate(action, Double.POSITIVE_INFINITY,
                    -1);
            speed = update.speed;

            // We cannot just call updatePosition with a negative delta so we re-create the location object
            // TODO : support negative delta
            location = convertPosition(schedule, sim, location.getPathPosition() - update.positionDelta);

        } while(speed < interpolate(speeds, location.getPathPosition()));
        return new CoastingSpeedController(location.getPathPosition(), endLocation);
    }

    private boolean isDecelerating(double position) {
        // TODO optimize this
        var announcers = findLimitSpeedAnnouncers(maxSpeedControllers);
        for (var announcer : announcers) {
            if (announcer.isActive(position))
                return true;
        }
        return false;
    }

    private Set<LimitAnnounceSpeedController> findLimitSpeedAnnouncers(Set<SpeedController> controllers) {
        var res = new HashSet<LimitAnnounceSpeedController>();
        for (var c : controllers) {
            if (c instanceof LimitAnnounceSpeedController)
                res.add((LimitAnnounceSpeedController) c);
        }
        return res;
    }

    @Override
    protected Set<SpeedController> getSpeedControllers(TrainSchedule schedule, double v1) {
        double timestep = 1;
        var wle = (2 * schedule.rollingStock.C * v1 + schedule.rollingStock.B) * v1 * v1;
        var vf = wle * v1 / (wle + schedule.rollingStock.rollingResistance(v1) * v1);
        double startLocation = findPhaseInitialLocation(schedule);
        double endLocation = findPhaseEndLocation(schedule);

        var currentSpeedControllers = new HashSet<>(maxSpeedControllers);
        currentSpeedControllers.add(new MaxSpeedController(v1, startLocation, endLocation));
        var expectedSpeeds = getExpectedSpeeds(sim, schedule, currentSpeedControllers, 1);

        for (var location : findPositionSameSpeedAsVF(expectedSpeeds, vf)) {
            currentSpeedControllers.add(generateCoastingSpeedControllerAtPosition(expectedSpeeds, location, timestep));
        }
        for (var location : findDecelerationPhases(vf)) {
            currentSpeedControllers.add(generateCoastingSpeedControllerAtPosition(expectedSpeeds, location, timestep));
        }
        return currentSpeedControllers;
    }
}
