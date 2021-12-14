package fr.sncf.osrd.speedcontroller.generators;

import static fr.sncf.osrd.train.TrainPhysicsIntegrator.nextStep;
import static java.lang.Math.abs;
import static java.util.Collections.max;

import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.MarginType;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.speedcontroller.*;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.TrainPhysicsIntegrator;
import fr.sncf.osrd.utils.SortedDoubleMap;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

public class MarecoAllowanceGenerator extends DichotomyControllerGenerator {

    /** Constructor */
    public MarecoAllowanceGenerator(double begin, double end,
                                    double allowanceValue, MarginType allowanceType) {
        super(begin, end, 5 * TIME_STEP, allowanceType, allowanceValue);
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

    /**
     * Compute vf given v1
     * @param v1 speed limit in MARECO algorithm
     * @return vf speed when the train starts braking in MARECO algorithm
     */
    public double vf(double v1) {
        var a = schedule.rollingStock.A;
        var b = schedule.rollingStock.B;
        var c = schedule.rollingStock.C;
        // formula given by MARECO
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
    protected double getFirstHighEstimate(SortedDoubleMap speeds) {
        double maxSpeed = max(speeds.values());

        double tolerance = .00001; // Stop if you're close enough
        int maxCount = 200; // Maximum number of Newton's method iterations
        double x = maxSpeed * 3 / 2; // at high v1 the equation vf = f(v1) tends to be vf = 2*v1/3

        for (int count = 1;
                //Carry on till we're close, or we've run it 200 times.
                (abs(newtonsMethod(x, maxSpeed)) > tolerance) && (count < maxCount);
                count++)  {

            x = x - newtonsMethod(x, maxSpeed) / newtonsMethodDerivative(x, maxSpeed);  //Newtons method.
        }

        if (abs(newtonsMethod(x, maxSpeed)) <= tolerance) {
            return x * DICHOTOMY_MARGIN;
        } else {
            return maxSpeed * DICHOTOMY_MARGIN; // if no value has been found return a high value to have some margin
        }
    }

    @Override
    protected double getFirstGuess(SortedDoubleMap speeds) {
        return (this.getFirstHighEstimate(speeds) + this.getFirstLowEstimate()) / 2;
    }

    /** Finds the end position of the coasting phases, that will then be generated backwards
     * with generateCoastingSpeedControllerAtPosition()
     * Coasting phases can be generated for two different reasons
     * - a deceleration phase where braking will be replaced by coasting
     * - before an accelerating slope */
    private List<Double> findEndOfCoastingPositions(SortedDoubleMap speeds, double v1) {
        var res = new ArrayList<Double>();
        var rollingStock = schedule.rollingStock;
        double vf = vf(v1);

        // coasting before deceleration phases
        var limitAnnounceSpeedControllers = findLimitSpeedAnnouncers(maxSpeedControllers);
        for (var announcer : limitAnnounceSpeedControllers) {
            double targetSpeed = announcer.targetSpeedLimit;
            // if that LimitAnnounceSpeedController is above v1 that means it will not have an impact here
            if (targetSpeed > v1)
                continue;
            // deceleration phases that are entirely above vf
            //TODO : same as below, find a way to make sure this targetSpeed is actually reached
            // because in some cases this announcer does not even have an impact
            // for example if there is another one more constraining before/below
            if (targetSpeed > vf && abs(speeds.interpolate(announcer.endPosition) - targetSpeed) < 1) {
                res.add(announcer.endPosition);
                continue;
            }
            // deceleration phases that cross vf
            // From vf to targetSpeedLimit
            double requiredBrakingDistance = Double.max(0,
                    computeBrakingDistance(announcer.beginPosition, announcer.endPosition, vf, targetSpeed, schedule));
            //TODO : modifiy this once the envelopes are implemented
            // we need to take into accounts positions that are still on the deceleration phase
            // to avoid the case where vf is high and then requiredBrakingDistance is very high
            var speedSupposedToBeVf = speeds.interpolate(announcer.endPosition - requiredBrakingDistance);
            if (abs(speedSupposedToBeVf - vf) < 1)
                res.add(announcer.endPosition - requiredBrakingDistance);
        }

        var brakingSpeedControllers = findBrakingSpeedControllers(maxSpeedControllers);
        for (var announcer : brakingSpeedControllers) {
            // if that BrakingSpeedController is above v1 that means it will not have an impact here
            var targetSpeedLimit = announcer.values.lastEntry().getValue();
            if (targetSpeedLimit > v1)
                continue;
            // deceleration phases that are entirely above vf
            if (targetSpeedLimit > vf) {
                res.add(announcer.endPosition);
                continue;
            }
            // deceleration phases that cross vf
            double targetSpeed = targetSpeedLimit;
            // From vf to targetSpeedLimit
            double requiredBrakingDistance;
            requiredBrakingDistance = Double.max(0,
                    computeBrakingDistance(announcer.beginPosition, announcer.endPosition, vf, targetSpeed, schedule));
            res.add(announcer.endPosition - requiredBrakingDistance);
        }

        // coasting before accelerating slopes
        var acceleratingSlopes = findAcceleratingSlopes(speeds, rollingStock, vf);
        double wle = rollingStock.rollingResistance(v1) * v1 * vf / (v1 - vf);
        for (var slope : acceleratingSlopes) {
            // formulas given my MARECO
            // giving the optimized speed v the train should have when entering the accelerating slope
            // this speed v might not be reached if the slope is not long enough, then we just enter the slope with
            // the lowest possible speed that will catch up with target speed at the end
            double v = 1 / (rollingStock.rollingResistance(v1)
                    / (wle * (1 - slope.previousAcceleration / slope.acceleration)) + 1 / v1);
            double target = slope.targetSpeed;
            double requiredAcceleratingDistance = Math.max((target * target - v * v) / (2 * slope.acceleration), 0);
            double positionWhereTargetSpeedIsReached = slope.beginPosition + requiredAcceleratingDistance;
            res.add(Math.min(slope.endPosition, positionWhereTargetSpeedIsReached));
        }
        return res.stream()
                .filter(position -> position > 0)
                .collect(Collectors.toList());
    }

    @SuppressWarnings({"checkstyle:WhitespaceAfter", "checkstyle:WhitespaceAround"})
    private ArrayList<AcceleratingSlope> findAcceleratingSlopes(
            SortedDoubleMap speeds, RollingStock rollingStock, double vf) {

        var res = new ArrayList<AcceleratingSlope>();
        double previousPosition = 0.0;
        double previousSpeed = 0.0;
        double previousAcceleration = 0.0;
        double meanAcceleration = 0.0;
        double accelerationLength = 0.0;
        var currentAcceleratingSlope = new AcceleratingSlope(0, 0, 0, 0, 0);
        for (var element : speeds.entrySet()) {
            double position = element.getKey();
            var location = convertPosition(schedule, position);
            double speed = element.getValue();
            var integrator = new TrainPhysicsIntegrator(TIME_STEP, rollingStock, location, speed);
            var naturalAcceleration = integrator.computeAcceleration(Action.coast());
            if (speed < vf || speed > previousSpeed) { // if v < vf or the train is accelerating, just update variables
                previousAcceleration = naturalAcceleration;
                previousSpeed = speed;
                previousPosition = location.getPathPosition();
                continue;
            }
            if (naturalAcceleration > 0) {
                // beginning of accelerating slope
                // add acceleration * distance step to the weighted mean acceleration
                var distanceStep = location.getPathPosition() - previousPosition;
                meanAcceleration += naturalAcceleration * distanceStep;
                accelerationLength += distanceStep;
                if (previousAcceleration < 0) {
                    currentAcceleratingSlope.previousAcceleration = previousAcceleration;
                    currentAcceleratingSlope.beginPosition = location.getPathPosition();
                }
            } else if (naturalAcceleration < 0 && accelerationLength > 0) {
                // end the accelerating slope
                currentAcceleratingSlope.endPosition = previousPosition;
                currentAcceleratingSlope.targetSpeed = speed;
                meanAcceleration /= accelerationLength;
                currentAcceleratingSlope.acceleration = meanAcceleration;
                res.add(currentAcceleratingSlope);
                // reset meanAcceleration, accelerationLength, and accelerating slope
                meanAcceleration = 0;
                accelerationLength = 0;
                currentAcceleratingSlope = new AcceleratingSlope(0, 0, 0, 0, 0);
            }
            previousAcceleration = naturalAcceleration;
            previousSpeed = speed;
            previousPosition = location.getPathPosition();
        }
        if (accelerationLength > 0)
            res.add(currentAcceleratingSlope);
        return res;
    }

    private CoastingSpeedController generateCoastingSpeedControllerAtPosition(SortedDoubleMap speeds,
                                                                              double endLocation) {
        double speed = speeds.interpolate(endLocation);

        var location = convertPosition(schedule, endLocation);

        do {
            var step = nextStep(
                    location,
                    speed,
                    schedule.rollingStock,
                    TIME_STEP,
                    location.getPathPosition(),
                    -1,
                    (integrator) -> Action.coast()
            );
            speed = step.finalSpeed;
            if (speed == 0)
                return null;
            location.updatePosition(schedule.rollingStock.length, step.positionDelta);

        } while (speed < speeds.interpolate(location.getPathPosition()));
        return new CoastingSpeedController(location.getPathPosition(), endLocation);
    }

    private Set<LimitAnnounceSpeedController> findLimitSpeedAnnouncers(Set<SpeedController> controllers) {
        var res = new HashSet<LimitAnnounceSpeedController>();
        for (var c : controllers) {
            if (c instanceof LimitAnnounceSpeedController)
                res.add((LimitAnnounceSpeedController) c);
        }
        return res;
    }

    private Set<BrakingSpeedController> findBrakingSpeedControllers(Set<SpeedController> controllers) {
        var res = new HashSet<BrakingSpeedController>();
        for (var c : controllers) {
            if (c instanceof BrakingSpeedController)
                res.add((BrakingSpeedController) c);
        }
        return res;
    }

    @Override
    protected Set<SpeedController> getSpeedControllers(TrainSchedule schedule,
                                                       double v1) throws SimulationError {
        return getSpeedControllers(schedule, v1, sectionBegin, sectionEnd);
    }

    @Override
    protected Set<SpeedController> getSpeedControllers(TrainSchedule schedule,
                                                       double v1,
                                                       double begin,
                                                       double end) throws SimulationError {
        var currentSpeedControllers = new HashSet<>(maxSpeedControllers);
        currentSpeedControllers.add(new MaxSpeedController(v1, begin, end));
        var expectedSpeeds = getExpectedSpeeds(schedule, currentSpeedControllers, TIME_STEP);
        var endOfCoastingPositions = findEndOfCoastingPositions(expectedSpeeds, v1);
        for (var location : endOfCoastingPositions) {
            var controller = generateCoastingSpeedControllerAtPosition(expectedSpeeds, location);
            if (controller != null)
                currentSpeedControllers.add(controller);
        }
        return currentSpeedControllers;
    }

    @Override
    protected void initializeBinarySearch(TrainSchedule schedule, SortedDoubleMap speeds) { }

    @Override
    protected double computeBrakingDistance(double initialPosition,
                                            double endPosition,
                                            double initialSpeed,
                                            double targetSpeed,
                                            TrainSchedule schedule) {
        if (schedule.rollingStock.gammaType == RollingStock.GammaType.CONST)
            return (initialSpeed * initialSpeed - targetSpeed * targetSpeed) / (2 * schedule.rollingStock.gamma);

        var res = getExpectedSpeedsBackwards(schedule, targetSpeed, endPosition, initialSpeed, TIME_STEP);
        return res.lastKey() - res.firstKey();
    }
}
