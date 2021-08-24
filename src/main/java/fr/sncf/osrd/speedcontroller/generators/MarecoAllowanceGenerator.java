package fr.sncf.osrd.speedcontroller.generators;

import static java.util.Collections.max;
import static java.util.Collections.min;

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

    private static class AcceleratingSlope {
        private double beginPosition;
        private double endPosition;
        private double acceleration;
        private double previousAcceleration;
        private double targetSpeed;

        private AcceleratingSlope(
                double beginPosition,
                double endPosition,
                double acceleration,
                double previousAcceleration,
                double targetSpeed
        ) {
            this.beginPosition = beginPosition;
            this.endPosition = endPosition;
            this.acceleration = acceleration;
            this.previousAcceleration = previousAcceleration;
            this.targetSpeed = targetSpeed;
        }
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

        double tolerance = .00001; // Stop if you're close enough
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
        return (this.getFirstHighEstimate() + this.getFirstLowEstimate()) / 2;
    }

    private List<Double> findEndOfCoastingPositions(SortedDoubleMap speeds, double v1) {
        var res = new ArrayList<Double>();
        var rollingStock = schedule.rollingStock;
        double vf = vf(v1);
        var limitAnnounceSpeedControllers = findLimitSpeedAnnouncers(maxSpeedControllers);

        // coasting before deceleration phases
        for (var announcer : limitAnnounceSpeedControllers) {
            // if that LimitAnnounceSpeedController is above v1 that means it will never apply here
            if (v1 < announcer.targetSpeedLimit) {
                continue;
            } else {
                // deceleration phases that are entirely above vf
                if (announcer.targetSpeedLimit > vf)
                    res.add(announcer.endPosition);
                    // deceleration phases that are entirely above vf
                else {
                    double targetSpeed = announcer.targetSpeedLimit;
                    double gamma = schedule.rollingStock.gamma;
                    // TODO : adapt this to non-constant deceleration
                    var requiredBrakingDistance = (vf * vf - targetSpeed * targetSpeed) / (2 * gamma);
                    res.add(announcer.endPosition - requiredBrakingDistance);
                }
            }
        }
        // coasting before accelerating slopes
        var acceleratingSlopes = new ArrayList<AcceleratingSlope>();
        double previousPosition = 0.0;
        double previousSpeed = 0.0;
        double previousAcceleration = 0.0;
        var currentAcceleratingSlope = new AcceleratingSlope(0, 0, 0, 0, 0);
        for (var element : speeds.entrySet()) {
            double position = element.getKey();
            var location = convertPosition(schedule, sim, position);
            double speed = element.getValue();
            var integrator = TrainPhysicsIntegrator.make(TIME_STEP, rollingStock,
                    speed, location.meanTrainGrade());
            var effectiveOppositeForces = Math.copySign(rollingStock.rollingResistance(speed), -speed);
            var naturalAcceleration = integrator.computeTotalForce(effectiveOppositeForces, 0) /
                    (rollingStock.inertiaCoefficient * rollingStock.mass);
            if (speed < vf || speed > previousSpeed) {
                previousAcceleration = naturalAcceleration;
                previousSpeed = speed;
                previousPosition = location.getPathPosition();
                continue;
            }
            // beginning of accelerating slope
            if (naturalAcceleration > 0 && previousAcceleration < 0) {
                currentAcceleratingSlope.acceleration = naturalAcceleration;
                currentAcceleratingSlope.previousAcceleration = previousAcceleration;
                currentAcceleratingSlope.beginPosition = location.getPathPosition();
            }
            // end of accelerating slope
            else if (naturalAcceleration < 0 && previousAcceleration > 0 && currentAcceleratingSlope.acceleration != 0) {
                currentAcceleratingSlope.endPosition = previousPosition;
                currentAcceleratingSlope.targetSpeed = speed;
                acceleratingSlopes.add(currentAcceleratingSlope);
                currentAcceleratingSlope = new AcceleratingSlope(0, 0, 0, 0, 0);
            }
            previousAcceleration = naturalAcceleration;
            previousSpeed = speed;
            previousPosition = location.getPathPosition();
        }
        double wle = rollingStock.rollingResistance(v1) * v1 * vf / (v1 - vf);
        for (var slope : acceleratingSlopes) {
            // formulas given my MARECO
            // giving the optimized speed v the train should have when entering the accelerating slope
            // this speed v might not be reached if the slope is not long enough, then we just enter the slope with
            // the lowest possible speed that will catch up with target speed at the end
            double v = 1 / (rollingStock.rollingResistance(v1) / (wle * (1 - slope.previousAcceleration / slope.acceleration)) + 1 / v1);
            double target = slope.targetSpeed;
            double requiredAcceleratingDistance = Math.max((target * target - v * v) / (2 * slope.acceleration), 0);
            double positionWhereTargetSpeedIsReached = slope.beginPosition + requiredAcceleratingDistance;
            res.add(Math.min(slope.endPosition, positionWhereTargetSpeedIsReached));
        }
        return res;
    }

    private static TrainPositionTracker convertPosition(TrainSchedule schedule, Simulation sim, double position) {
        var location = Train.getInitialLocation(schedule, sim);
        location.updatePosition(schedule.rollingStock.length, position);
        return location;
    }

    @SuppressWarnings("checkstyle:WhitespaceAfter")
    private CoastingSpeedController generateCoastingSpeedControllerAtPosition(SortedDoubleMap speeds,
                                                                              double endLocation, double timestep) {
        double speed = speeds.interpolate(endLocation);

        var location = convertPosition(schedule, sim, endLocation);
        location.ignoreInfraState = true;

        do {
            var integrator = TrainPhysicsIntegrator.make(timestep, schedule.rollingStock,
                    speed, location.meanTrainGrade());
            var action = Action.coast();
            var update =  integrator.computeUpdate(action, location.getPathPosition(),-1);
            speed = update.speed;
            if (speed == 0)
                return null;
            location.updatePosition(schedule.rollingStock.length, update.positionDelta);

        } while (speed < speeds.interpolate(location.getPathPosition()));
        return new CoastingSpeedController(location.getPathPosition(), endLocation);
    }

    private boolean isDecelerating(double position) {
        // TODO optimize this
        var announcers = findLimitSpeedAnnouncers(maxSpeedControllers);
        for (var announcer : announcers) {
            if (announcer.isActive(position, 0))
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
        var currentSpeedControllers = new HashSet<>(maxSpeedControllers);
        currentSpeedControllers.add(new MaxSpeedController(v1, startLocation, endLocation));
        var expectedSpeeds = getExpectedSpeeds(sim, schedule, currentSpeedControllers, TIME_STEP);
        var endOfCoastingPositions = findEndOfCoastingPositions(expectedSpeeds, v1);
        for (var location : endOfCoastingPositions) {
            var controller = generateCoastingSpeedControllerAtPosition(expectedSpeeds, location, TIME_STEP);
            if (controller != null)
                currentSpeedControllers.add(controller);
        }
        return currentSpeedControllers;
    }
}
