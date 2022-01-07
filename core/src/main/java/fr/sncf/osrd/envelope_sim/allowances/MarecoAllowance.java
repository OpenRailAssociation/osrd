package fr.sncf.osrd.envelope_sim.allowances;

import static fr.sncf.osrd.envelope_sim.overlays.EnvelopeAcceleration.accelerate;
import static fr.sncf.osrd.envelope_sim.overlays.EnvelopeCoasting.coast;
import static fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration.decelerate;
import static fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope.ACCELERATION;
import static fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope.MAINTAIN;
import static fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope.*;
import static fr.sncf.osrd.speedcontroller.generators.SpeedControllerGenerator.TIME_STEP;
import static java.lang.Math.abs;
import static java.util.Collections.sort;

import fr.sncf.osrd.envelope.*;
import fr.sncf.osrd.envelope_sim.PhysicsPath;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeCoasting;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator;
import fr.sncf.osrd.utils.CmpOperator;
import fr.sncf.osrd.utils.DoubleBinarySearch;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.*;
import java.util.stream.Collectors;

public class MarecoAllowance implements Allowance {
    private final Logger logger = LoggerFactory.getLogger(MarecoAllowance.class);

    public final PhysicsRollingStock rollingStock;
    public final PhysicsPath path;
    public final double timeStep;

    public final double sectionBegin;
    public final double sectionEnd;

    public final AllowanceValue allowanceValue;

    // potential speed limit under which the train would use too much capacity
    public final double capacitySpeedLimit;

    public static final class CoastingMeta extends EnvelopePartMeta {
    }

    public static final EnvelopePartMeta COASTING = new CoastingMeta();

    /** Constructor */
    public MarecoAllowance(
            PhysicsRollingStock rollingStock,
            PhysicsPath path,
            double timeStep,
            double begin,
            double end,
            double capacitySpeedLimit,
            AllowanceValue allowanceValue
    ) {
        this.rollingStock = rollingStock;
        this.path = path;
        this.timeStep = timeStep;
        this.sectionBegin = begin;
        this.sectionEnd = end;
        this.capacitySpeedLimit = capacitySpeedLimit;
        this.allowanceValue = allowanceValue;
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
        // formulas given by MARECO
        var wle = v1 * v1 * rollingStock.getRollingResistanceDeriv(v1);
        return wle * v1 / (wle + rollingStock.getRollingResistance(v1) * v1);
    }

    // we will try to find v1 so that f(v1, vmax) == 0
    public double newtonsMethod(double v1, double vmax) {
        return vf(v1) - vmax;
    }

    /**
     * First derivative of newtonsMethod
     * df(v1, vmax)/dv1
     */
    public double newtonsMethodDerivative(double v1) {
        // formulas given by MARECO
        var wle = v1 * v1 * rollingStock.getRollingResistanceDeriv(v1);
        var wleDerivative = v1 * (2 * rollingStock.getRollingResistanceDeriv(v1)
                + v1 * rollingStock.getRollingResistanceSecDeriv(v1));

        var u = wle * v1;
        var du = wleDerivative * v1 + wle;
        var v = wle + rollingStock.getRollingResistance(v1) * v1;
        var dv = wleDerivative + rollingStock.getRollingResistanceDeriv(v1) * v1
                + rollingStock.getRollingResistance(v1);
        return (du * v - dv * u) / (v * v);
    }


    /** Finds the end position of the coasting phases, that will then be generated backwards
     * with generateCoastingSpeedControllerAtPosition()
     * Coasting phases can be generated for two different reasons
     * - a deceleration phase where braking will be replaced by coasting
     * - before an accelerating slope */
    private List<Double> findEndOfCoastingPositions(Envelope envelope, double v1) {
        var res = new ArrayList<Double>();
        double vf = vf(v1);

        // coasting before deceleration phases
        var brakingEnvelopeParts = findBrakingEnvelopeParts(envelope);
        for (var part : brakingEnvelopeParts) {
            double targetSpeed = part.getEndSpeed();
            // if that LimitAnnounceSpeedController is above v1 that means it will not have an impact here
            if (targetSpeed > v1)
                continue;
            // deceleration phases that are entirely above vf
            if (targetSpeed > vf) {
                res.add(part.getEndPos());
                continue;
            }
            // deceleration phases that cross vf
            if (part.getMaxSpeed() > vf)
                res.add(part.interpolatePosition(vf));
        }

        // coasting before accelerating slopes
        var acceleratingSlopes =
                findAcceleratingSlopes(envelope, rollingStock, vf);
        double wle = rollingStock.getRollingResistance(v1) * v1 * vf / (v1 - vf);
        for (var slope : acceleratingSlopes) {
            // formulas given my MARECO
            // giving the optimized speed v the train should have when entering the accelerating slope
            // this speed v might not be reached if the slope is not long enough, then we just enter the slope with
            // the lowest possible speed that will catch up with target speed at the end
            double v = 1 / (rollingStock.getRollingResistance(v1)
                    / (wle * (1 - slope.previousAcceleration / slope.acceleration)) + 1 / v1);
            double target = slope.targetSpeed;
            double requiredAcceleratingDistance = Math.max((target * target - v * v) / (2 * slope.acceleration), 0);
            double positionWhereTargetSpeedIsReached = slope.beginPosition + requiredAcceleratingDistance;
            res.add(Math.min(slope.endPosition, positionWhereTargetSpeedIsReached));
        }
        sort(res);
        return res.stream()
                .filter(position -> position > 0)
                .collect(Collectors.toList());
    }

    private ArrayList<AcceleratingSlope> findAcceleratingSlopes(Envelope envelope,
                                                                PhysicsRollingStock rollingStock,
                                                                double vf) {
        var res = new ArrayList<AcceleratingSlope>();
        double previousPosition = 0.0;
        double previousAcceleration = 0.0;
        double meanAcceleration = 0.0;
        double accelerationLength = 0.0;
        var currentAcceleratingSlope =
                new AcceleratingSlope(0, 0, 0, 0, 0);
        var cursor = EnvelopeCursor.forward(envelope);
        // scan until maintain speed envelope parts
        while (cursor.findPart(MaxEffortEnvelope::maxEffortPlateau)) {
            // constant parameters on this plateau
            double speed = cursor.getStepBeginSpeed();
            // no coasting will be triggered if the speed is below vf
            if (speed <= vf) {
                cursor.nextPart();
                continue;
            }

            // constant variables for this plateau
            double rollingResistance = rollingStock.getRollingResistance(speed);
            var envelopePart = cursor.getPart();
            var positionStep = this.timeStep * speed;

            // initializing variables
            double position = cursor.getPosition();
            double weightForce = TrainPhysicsIntegrator.getWeightForce(rollingStock, path, position);
            var naturalAcceleration = TrainPhysicsIntegrator.computeAcceleration(rollingStock,
                    rollingResistance, weightForce, speed, 0, 0, 1);

            while (cursor.getPosition() <= envelopePart.getEndPos()) {

                if (naturalAcceleration > 0) {
                    // beginning of accelerating slope
                    // add acceleration * distance step to the weighted mean acceleration
                    var distanceStep = cursor.getStepLength();
                    meanAcceleration += naturalAcceleration * distanceStep;
                    accelerationLength += distanceStep;
                    if (previousAcceleration < 0) {
                        currentAcceleratingSlope.previousAcceleration = previousAcceleration;
                        currentAcceleratingSlope.beginPosition = cursor.getStepBeginPos();
                    }
                } else if (naturalAcceleration <= 0 && accelerationLength > 0) {
                    // end the accelerating slope
                    currentAcceleratingSlope.endPosition = previousPosition;
                    currentAcceleratingSlope.targetSpeed = speed;
                    meanAcceleration /= accelerationLength;
                    currentAcceleratingSlope.acceleration = meanAcceleration;
                    res.add(currentAcceleratingSlope);
                    // reset meanAcceleration, accelerationLength, and accelerating slope
                    meanAcceleration = 0;
                    accelerationLength = 0;
                    currentAcceleratingSlope =
                            new AcceleratingSlope(
                                    0, 0, 0, 0, 0
                            );
                }
                previousAcceleration = naturalAcceleration;
                previousPosition = position;
                cursor.findPosition(position + positionStep);
                if (cursor.hasReachedEnd())
                    break;
                position = cursor.getPosition();
                weightForce = TrainPhysicsIntegrator.getWeightForce(rollingStock, path, position);
                naturalAcceleration = TrainPhysicsIntegrator.computeAcceleration(rollingStock,
                        rollingResistance, weightForce, speed, 0, 0, 1);
            }
            // if the end of the plateau is an accelerating slope
            if (accelerationLength > 0) {
                currentAcceleratingSlope.endPosition = previousPosition;
                currentAcceleratingSlope.targetSpeed = speed;
                meanAcceleration /= accelerationLength;
                currentAcceleratingSlope.acceleration = meanAcceleration;
                res.add(currentAcceleratingSlope);
                // reset meanAcceleration, accelerationLength, and accelerating slope
                meanAcceleration = 0;
                accelerationLength = 0;
                currentAcceleratingSlope =
                        new AcceleratingSlope(0, 0, 0, 0, 0);
            }
        }
        return res;
    }

    /** Generate coasting overlay at a specific position */
    public Envelope addCoastingCurvesAtPosition(
            Envelope envelope,
            List<Double> endOfCoastingPositions
    ) {
        for (var position : endOfCoastingPositions) {
            var builder = OverlayEnvelopeBuilder.backward(envelope);
            builder.cursor.findPosition(position);
            var speed = envelope.interpolateSpeed(position);
            var partBuilder = builder.startContinuousOverlay(COASTING);
            EnvelopeCoasting.coast(rollingStock, path, timeStep, position, speed, partBuilder, -1);
            builder.addPart(partBuilder);
            envelope = builder.build();
        }
        return envelope;
    }


    /** Returns all the braking envelopeParts in a given envelope */
    private Set<EnvelopePart> findBrakingEnvelopeParts(Envelope envelope) {
        var res = new HashSet<EnvelopePart>();
        for (var part : envelope) {
            if (part.meta instanceof DecelerationMeta || part.meta instanceof StopMeta)
                res.add(part);
        }
        return res;
    }


    /** Returns the total envelope after applying an allowance with target speed v1 */
    public Envelope getEnvelope(Envelope base, ArrayList<EnvelopePart> physicalLimits, double v1) {
        var baseRoIEnvelope = Envelope.make(base.slice(sectionBegin, sectionEnd));
        var envelopeCapped = EnvelopeSpeedCap.from(baseRoIEnvelope, null, v1);
        var endOfCoastingPositions = findEndOfCoastingPositions(envelopeCapped, v1);
        var marecoEnvelope = addCoastingCurvesAtPosition(envelopeCapped, endOfCoastingPositions);
        var builder = new MaxEnvelopeBuilder();
        physicalLimits.iterator().forEachRemaining(builder::addPart);
        marecoEnvelope.iterator().forEachRemaining(builder::addPart);
        // initial speed of the RoI
        double initialSpeed = base.interpolateSpeed(sectionBegin);
        if (v1 < initialSpeed) {
            var coastingBeginSpeed = computeCoastingBeginSpeed(initialSpeed, v1, physicalLimits);
            var coastingPart = generateCoastingPart(base, sectionBegin, coastingBeginSpeed);
            assert coastingPart.getEndPos() > coastingPart.getBeginPos();
            // TODO : find a way to include this coasting part into the final result without bugs
            // builder.addPart(coastingPart);
        }
        var roiEnvelope = builder.build();

        var partsBefore = base.slice(Double.NEGATIVE_INFINITY, sectionBegin);
        var partsAfter = base.slice(sectionEnd, Double.POSITIVE_INFINITY);
        var totalBuilder = new EnvelopeBuilder();
        for (var part : partsBefore)
            totalBuilder.addPart(part);
        for (int i = 0; i < roiEnvelope.size(); i++)
            totalBuilder.addPart(roiEnvelope.get(i));
        for (var part : partsAfter)
            totalBuilder.addPart(part);
        return totalBuilder.build();
    }

    /** compute where the coasting phase is supposed to start, given the initial and target speed */
    private double computeCoastingBeginSpeed(double initialSpeed,
                                             double targetSpeed,
                                             ArrayList<EnvelopePart> physicalLimits) {
        var coastingBeginSpeed = initialSpeed;
        var minPhysicalSpeed = initialSpeed;
        for (var part : physicalLimits) {
            if (part.getMinSpeed() < minPhysicalSpeed)
                minPhysicalSpeed = part.getMinSpeed();
        }
        // transform the target speed into a coasting begin speed, located between initialSpeed and minPhyscialSpeed
        if (targetSpeed < minPhysicalSpeed && minPhysicalSpeed != 0)
            coastingBeginSpeed = targetSpeed * ((initialSpeed - minPhysicalSpeed) / minPhysicalSpeed)
                    + minPhysicalSpeed;
        return coastingBeginSpeed;
    }

    /** compute the physical limits on the Region of Interest (RoI)
     * these limits are a composed of a braking curve at the beginning, an accelerating curve at the end,
     * with a 30km/h limit in between if it exists */
    private ArrayList<EnvelopePart> generatePhysicalLimits(Envelope base) {

        double initialSpeed = base.interpolateSpeed(sectionBegin);
        double finalSpeed = base.interpolateSpeed(sectionEnd);

        var res = new ArrayList<EnvelopePart>();
        if (initialSpeed > 0) {
            var decelerationPart = generateDecelerationPart(base, initialSpeed);
            res.add(decelerationPart);
        }
        if (finalSpeed > 0) {
            var accelerationPart = generateAccelerationPart(base, finalSpeed);
            res.add(accelerationPart);
        }
        if (capacitySpeedLimit > 0) {
            var maintainPart = generateMaintainPart(capacitySpeedLimit);
            res.add(maintainPart);
        }
        return res;
    }


    private EnvelopePart generateDecelerationPart(Envelope base, double initialSpeed) {
        var builder = OverlayEnvelopeBuilder.forward(base);
        builder.cursor.findPosition(sectionBegin);
        var partBuilder = builder.startContinuousOverlay(DECELERATION);
        partBuilder.addSpeedThreshold(capacitySpeedLimit, CmpOperator.LOWER);
        decelerate(rollingStock, path, TIME_STEP, sectionBegin, initialSpeed, partBuilder, 1);
        var decelerationPart = partBuilder.build();
        return decelerationPart.slice(sectionBegin, sectionEnd);
    }

    private EnvelopePart generateCoastingPart(Envelope base, double initialPosition, double initialSpeed) {
        var builder = OverlayEnvelopeBuilder.forward(base);
        builder.cursor.findPosition(initialPosition);
        var partBuilder = builder.startDiscontinuousOverlay(COASTING, initialSpeed);
        partBuilder.addSpeedThreshold(capacitySpeedLimit, CmpOperator.LOWER);
        coast(rollingStock, path, TIME_STEP, initialPosition, initialSpeed, partBuilder, 1);
        var coastingPart = partBuilder.build();
        return coastingPart.slice(sectionBegin, sectionEnd);
    }

    private EnvelopePart generateMaintainPart(double speed) {
        return EnvelopePart.generateTimes(
                MAINTAIN,
                new double[]{sectionBegin, sectionEnd},
                new double[]{speed, speed}
        );
    }

    private EnvelopePart generateAccelerationPart(Envelope base, double finalSpeed) {
        var builder = OverlayEnvelopeBuilder.backward(base);
        builder.cursor.findPosition(sectionEnd);
        var partBuilder = builder.startContinuousOverlay(ACCELERATION);
        partBuilder.addSpeedThreshold(capacitySpeedLimit, CmpOperator.LOWER);
        accelerate(rollingStock, path, TIME_STEP, sectionEnd, finalSpeed, partBuilder, -1);
        var acceleratingPart = partBuilder.build();
        return acceleratingPart.slice(sectionBegin, sectionEnd);
    }

    private double getMarginTime(Envelope envelope) {
        return envelope.interpolateTotalTime(sectionEnd) - envelope.interpolateTotalTime(sectionBegin);
    }

    // get the high boundary for the binary search, corresponding to vf = max
    protected double getFirstHighEstimate(Envelope envelope) {
        double maxSpeed = envelope.getMaxSpeed();

        double tolerance = .0001; // Stop if you're close enough
        int maxCount = 200; // Maximum number of Newton's method iterations
        double x = maxSpeed * 3 / 2; // at high v1 the equation vf = f(v1) tends to be vf = 2*v1/3

        for (int count = 1;
                //Carry on till we're close, or we've run it 200 times.
                abs(newtonsMethod(x, maxSpeed)) > tolerance && count < maxCount;
                count++)  {
            x = x - newtonsMethod(x, maxSpeed) / newtonsMethodDerivative(x);  //Newtons method.
        }

        if (abs(newtonsMethod(x, maxSpeed)) <= tolerance) {
            return x;
        } else {
            return maxSpeed; // if no value has been found return a high value to have some margin
        }
    }

    @Override
    public Envelope apply(Envelope base) {
        var baseTime = getMarginTime(base);
        var distance = sectionEnd - sectionBegin;
        var targetTime = baseTime + allowanceValue.getAllowanceTime(baseTime, distance);

        var physicalLimits = generatePhysicalLimits(base);

        logger.debug("total time {}, trying to get to {}", baseTime, targetTime);

        Envelope curEnvelope = base;
        var errorMargin = 5.0 * timeStep;
        var initialHighBound = getFirstHighEstimate(base) * 1.05;
        var search = new DoubleBinarySearch(0, initialHighBound, targetTime, errorMargin, true);
        for (int i = 1; i < 21 && !search.complete(); i++) {
            var input = search.getInput();
            logger.debug("starting attempt {} with v1 = {}", i, input);
            curEnvelope = getEnvelope(base, physicalLimits, input);
            var output = getMarginTime(curEnvelope);
            logger.debug("envelope time {}", output);
            search.feedback(output);
        }

        if (!search.complete())
            throw new RuntimeException("mareco simulation did not converge");

        return curEnvelope;
    }
}
