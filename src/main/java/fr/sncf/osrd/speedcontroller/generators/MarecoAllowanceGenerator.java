package fr.sncf.osrd.speedcontroller.generators;

import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.MarecoAllowance.MarginType;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.CoastingSpeedController;
import fr.sncf.osrd.speedcontroller.LimitAnnounceSpeedController;
import fr.sncf.osrd.speedcontroller.MaxSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPhysicsIntegrator;
import fr.sncf.osrd.train.TrainPositionTracker;
import fr.sncf.osrd.utils.SortedDoubleMap;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import java.util.*;

import static java.util.Collections.max;

public class MarecoAllowanceGenerator extends DichotomyControllerGenerator {

    // TODO use this parameter
    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public final RJSAllowance.MarecoAllowance.MarginType allowanceType;
    public final double value;

    /** Constructor */
    public MarecoAllowanceGenerator(double begin, double end,
                                    double allowanceValue, MarginType allowanceType) {
        super(begin, end, 5);
        this.allowanceType = allowanceType;
        this.value = allowanceValue;
    }

    @Override
    protected double getTargetTime(double baseTime) {
        return baseTime * (1 + value / 100);
    }

    /**
     * Compute vf given v1
     * @param v1 speed limit in MARECO algorithm
     * @return vf speed when the train starts braking in MARECO algorithm
     */
    public double vf(double v1) {
        var a = schedule.rollingStock.A;
        var b = schedule.rollingStock.B;
        var c = schedule.rollingStock.C;
        double vf = (2 * c * v1 * v1 * v1 + b * v1 * v1) / (3 * c * v1 * v1 + 2 * b * v1 + a);
        return vf;
    }

    // we will try to find v1 so that f(v1, vmax) == 0
    public double newtonsMethod(double v1, double vmax) {
        return vf(v1) - vmax;
    }

    /**
     * First derivative of newtonsMethod
     * df(v1, vmax)/dv1
     */
    public double newtonsMethodDerivative(double v1, double vmax) {
        var a = schedule.rollingStock.A;
        var b = schedule.rollingStock.B;
        var c = schedule.rollingStock.C;
        var v = (3 * c * v1 * v1 + 2 * b * v1 + a);
        var dv = (6 * c * v1 + 2 * b);
        var u = (2 * c * v1 * v1 * v1 + b * v1 * v1) - vmax * v;
        var du = (6 * c * v1 * v1 + 2 * b * v1) - vmax * dv;
        return (du * v - dv * u) / (v * v);
    }

    @Override
    protected double getFirstLowEstimate() {
        return 0;
    }

    // get the high boundary for the binary search, corresponding to vf = max
    @Override
    protected double getFirstHighEstimate() {
        var speeds = getExpectedSpeeds(sim, schedule, maxSpeedControllers, TIME_STEP);
        double maxSpeed = max(speeds.values());

        double tolerance = .000001; // Stop if you're close enough
        int maxCount = 200; // Maximum number of Newton's method iterations
        double x = maxSpeed * 3 / 2; // at high v1 the equation vf = f(v1) tends to be vf = 2*v1/3

        for (int count = 1;
                //Carry on till we're close, or we've run it 200 times.
                (Math.abs(newtonsMethod(x, maxSpeed)) > tolerance) && (count < maxCount);
                count++)  {

            x = x - newtonsMethod(x, maxSpeed) / newtonsMethodDerivative(x, maxSpeed);  //Newtons method.
        }

        if (Math.abs(newtonsMethod(x, maxSpeed)) <= tolerance) {
            return x;
        } else {
            return maxSpeed * 2; // if no value has been found return a high value to have some margin
        }
    }

    @Override
    protected double getFirstGuess() {
        return this.getFirstHighEstimate() / (1 + value / 100);
    }

    private List<Double> findPositionSameSpeedAsVF(SortedDoubleMap speeds, double vf) {
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

    private CoastingSpeedController generateCoastingSpeedControllerAtPosition(SortedDoubleMap speeds,
                                                                              double endLocation, double timestep) {
        double speed = speeds.interpolate(endLocation);

        var location = convertPosition(schedule, sim, endLocation);

        do {
            var integrator = TrainPhysicsIntegrator.make(timestep, schedule.rollingStock,
                    speed, location.meanTrainGrade());
            var action = Action.coast();
            var update =  integrator.computeUpdate(action, Double.POSITIVE_INFINITY,
                    -1);
            speed = update.speed;

            // We cannot just call updatePosition with a negative delta so we re-create the location object
            // TODO (optimization): support negative delta
            location = convertPosition(schedule, sim, location.getPathPosition() - update.positionDelta);

        } while (speed < speeds.interpolate(location.getPathPosition()));
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
    protected Set<SpeedController> getSpeedControllers(TrainSchedule schedule,
                                                       double v1,
                                                       double startLocation,
                                                       double endLocation) {
        double timestep = 0.01; // TODO: link this timestep to the rest of the simulation
        var vf = vf(v1);

        var currentSpeedControllers = new HashSet<>(maxSpeedControllers);
        currentSpeedControllers.add(new MaxSpeedController(v1, startLocation, endLocation));
        var expectedSpeeds = getExpectedSpeeds(sim, schedule, currentSpeedControllers, timestep);

        for (var location : findPositionSameSpeedAsVF(expectedSpeeds, vf)) {
            if (isAccelerationPhase(expectedSpeeds, location))
                continue;
            var controller = generateCoastingSpeedControllerAtPosition(expectedSpeeds, location, timestep);
            currentSpeedControllers.add(controller);
        }
        for (var location : findDecelerationPhases(vf)) {
            var controller = generateCoastingSpeedControllerAtPosition(expectedSpeeds, location, timestep);
            currentSpeedControllers.add(controller);
        }
        return currentSpeedControllers;
    }

    private boolean isAccelerationPhase(SortedDoubleMap speeds, Double location) {
        double speed = speeds.interpolate(location);
        var entryBefore = speeds.floorEntry(location);
        double previousSpeed = entryBefore.getValue();
        return previousSpeed <= speed;
    }
}
