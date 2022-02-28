package fr.sncf.osrd.envelope_sim.allowances;

import static fr.sncf.osrd.envelope_sim.overlays.EnvelopeAcceleration.accelerate;
import static fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration.decelerate;
import static java.lang.Math.*;

import fr.sncf.osrd.envelope.*;
import fr.sncf.osrd.envelope.constraint.ConstrainedEnvelopePartBuilder;
import fr.sncf.osrd.envelope.constraint.EnvelopeCeiling;
import fr.sncf.osrd.envelope.constraint.SpeedFloor;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeCoasting;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator;
import fr.sncf.osrd.envelope_sim.StopMeta;
import fr.sncf.osrd.utils.DoubleBinarySearch;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.*;
import java.util.stream.Collectors;

public class MarecoAllowance implements Allowance {
    private final Logger logger = LoggerFactory.getLogger(MarecoAllowance.class);

    public final EnvelopeSimContext context;

    public final double sectionBegin;
    public final double sectionEnd;

    public final AllowanceValue allowanceValue;

    // potential speed limit under which the train would use too much capacity
    public final double capacitySpeedLimit;

    /** Constructor */
    public MarecoAllowance(
            EnvelopeSimContext context,
            double begin,
            double end,
            double capacitySpeedLimit,
            AllowanceValue allowanceValue
    ) {
        this.context = context;
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
        var wle = v1 * v1 * context.rollingStock.getRollingResistanceDeriv(v1);
        return wle * v1 / (wle + context.rollingStock.getRollingResistance(v1) * v1);
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
        var wle = v1 * v1 * context.rollingStock.getRollingResistanceDeriv(v1);
        var wleDerivative = v1 * (2 * context.rollingStock.getRollingResistanceDeriv(v1)
                + v1 * context.rollingStock.getRollingResistanceSecDeriv(v1));

        var u = wle * v1;
        var du = wleDerivative * v1 + wle;
        var v = wle + context.rollingStock.getRollingResistance(v1) * v1;
        var dv = wleDerivative + context.rollingStock.getRollingResistanceDeriv(v1) * v1
                + context.rollingStock.getRollingResistance(v1);
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
                findAcceleratingSlopes(envelope, vf);
        double wle = context.rollingStock.getRollingResistance(v1) * v1 * vf / (v1 - vf);
        for (var slope : acceleratingSlopes) {
            // formulas given my MARECO
            // giving the optimized speed v the train should have when entering the accelerating slope
            // this speed v might not be reached if the slope is not long enough, then we just enter the slope with
            // the lowest possible speed that will catch up with target speed at the end
            double v = 1 / (context.rollingStock.getRollingResistance(v1)
                    / (wle * (1 - slope.previousAcceleration / slope.acceleration)) + 1 / v1);
            double target = slope.targetSpeed;
            double requiredAcceleratingDistance = max((target * target - v * v) / (2 * slope.acceleration), 0);
            double positionWhereTargetSpeedIsReached = slope.beginPosition + requiredAcceleratingDistance;
            res.add(min(slope.endPosition, positionWhereTargetSpeedIsReached));
        }
        return res.stream()
                .filter(position -> position > 0)
                .sorted()
                .collect(Collectors.toList());
    }

    private ArrayList<AcceleratingSlope> findAcceleratingSlopes(Envelope envelope,
                                                                double vf) {
        var res = new ArrayList<AcceleratingSlope>();
        double previousPosition = envelope.getBeginPos();
        double previousAcceleration = 0.0;
        double meanAcceleration = 0.0;
        double accelerationLength = 0.0;
        var currentAcceleratingSlope =
                new AcceleratingSlope(previousPosition, 0, 0, 0, 0);
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
            double rollingResistance = context.rollingStock.getRollingResistance(speed);
            var envelopePart = cursor.getPart();
            var positionStep = context.timeStep * speed;

            // initializing variables
            double position = cursor.getPosition();
            double weightForce = TrainPhysicsIntegrator.getWeightForce(context.rollingStock, context.path, position);
            var naturalAcceleration = TrainPhysicsIntegrator.computeAcceleration(context.rollingStock,
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
                            new AcceleratingSlope(previousPosition, 0, 0, 0, 0);
                }
                previousAcceleration = naturalAcceleration;
                previousPosition = position;
                cursor.findPosition(position + positionStep);
                if (cursor.hasReachedEnd())
                    break;
                position = cursor.getPosition();
                weightForce = TrainPhysicsIntegrator.getWeightForce(context.rollingStock, context.path, position);
                naturalAcceleration = TrainPhysicsIntegrator.computeAcceleration(context.rollingStock,
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
                        new AcceleratingSlope(previousPosition, 0, 0, 0, 0);
            }
        }
        return res;
    }

    /** Generate coasting overlay at a specific position */
    public Envelope addCoastingCurvesAtPositions(
            Envelope envelope,
            List<Double> endOfCoastingPositions
    ) {
        for (var position : endOfCoastingPositions) {
            var part = envelope.getEnvelopePartLeft(position);
            if (part == null || (part.hasAttr(EnvelopeProfile.ACCELERATING) && part.getBeginPos() < position))
                continue; // Starting a coasting curve in an acceleration part would stop instantly and trigger asserts

            var partBuilder = new EnvelopePartBuilder();
            partBuilder.setAttr(EnvelopeProfile.COASTING);
            var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    new SpeedFloor(0),  // 0
                    new EnvelopeCeiling(envelope)  // 1
            );

            var speed = envelope.interpolateSpeed(position);
            EnvelopeCoasting.coast(context, position, speed, overlayBuilder, -1);

            // skip anything that's not an intersection with the base curve
            if (overlayBuilder.lastIntersection != 1)
                continue;

            // if coasting immediately intersected with the base curve, stop right away
            if (partBuilder.isEmpty())
                continue;

            var builder = OverlayEnvelopeBuilder.backward(envelope);
            builder.addPart(partBuilder.build());
            envelope = builder.build();
            assert envelope.continuous;
        }
        return envelope;
    }


    /** Returns true if the envelope part is a braking envelope */
    private static boolean isBraking(EnvelopePart part) {
        return part.hasAttr(EnvelopeProfile.BRAKING) || part.hasAttr(StopMeta.class);
    }


    /** Returns all the braking envelopeParts in a given envelope */
    private Set<EnvelopePart> findBrakingEnvelopeParts(Envelope envelope) {
        return envelope.stream()
                .filter(MarecoAllowance::isBraking)
                .collect(Collectors.toSet());
    }


    /** Returns the total envelope after applying an allowance with target speed v1 */
    public Envelope getEnvelope(Envelope baseRoIEnvelope, List<EnvelopePart> physicalLimits, double v1) {
        var envelopeCapped = EnvelopeSpeedCap.from(
                baseRoIEnvelope,
                List.of(EnvelopeProfile.CONSTANT_SPEED),
                v1
        );
        var endOfCoastingPositions = findEndOfCoastingPositions(envelopeCapped, v1);
        var marecoEnvelope = addCoastingCurvesAtPositions(envelopeCapped, endOfCoastingPositions);
        var builder = new MaxEnvelopeBuilder();
        physicalLimits.iterator().forEachRemaining(builder::addPart);
        marecoEnvelope.iterator().forEachRemaining(builder::addPart);
        // TODO : find a way to include coasting part into the final result without bugs
        var result = builder.build();
        assert result.continuous : "Envelope with allowance is not continuous";
        return result;
    }

    /** compute the physical limits on the Region of Interest (RoI)
     * these limits are a composed of a braking curve at the beginning, an accelerating curve at the end,
     * with a 30km/h limit in between if it exists */
    private List<EnvelopePart> generatePhysicalLimits(Envelope base) {
        var res = generateDecelerationParts(base);
        res.addAll(generateAccelerationParts(base));
        if (capacitySpeedLimit > 0) {
            var begin = Math.max(sectionBegin, base.getBeginPos());
            var end = Math.min(sectionEnd, base.getEndPos());
            var baseSliced = Envelope.make(base.slice(begin, end));
            var baseCapped = EnvelopeSpeedCap.from(baseSliced, List.of(), capacitySpeedLimit);
            for (var i = 0; i < baseCapped.size(); i++)
                res.add(baseCapped.get(i));
        }
        return res;
    }


    /** Moves the position forward until it's not in a braking section,
     * returns -1 if it reaches the end of the path*/
    private double moveForwardUntilNotBraking(Envelope base, double position) {
        var envelopeIndex = base.findEnvelopePartIndexLeft(position);
        while (envelopeIndex < base.size() && isBraking(base.get(envelopeIndex)))
            envelopeIndex++;
        if (envelopeIndex >= base.size())
            return -1;
        return max(position, base.get(envelopeIndex).getBeginPos());
    }


    /** Moves the position backwards until it's not in an accelerating section,
     * returns -1 if it reaches the beginning of the path*/
    private double moveBackwardsUntilNotAccelerating(Envelope base, double position) {
        var envelopeIndex = base.findEnvelopePartIndexLeft(position);
        while (envelopeIndex >= 0 && base.get(envelopeIndex).hasAttr(EnvelopeProfile.ACCELERATING))
            envelopeIndex--;
        if (envelopeIndex < 0)
            return -1;
        return min(position, base.get(envelopeIndex).getEndPos());
    }


    private List<EnvelopePart> generateDecelerationParts(Envelope base) {
        var res = new ArrayList<EnvelopePart>();
        var position = moveForwardUntilNotBraking(base, base.getBeginPos());
        assert position >= 0 : "We can't lose time in an area where we are always braking";
        if (position > base.getBeginPos())
            res.addAll(Arrays.asList(base.slice(base.getBeginPos(), position)));
        if (position > base.getEndPos())
            return res;
        var speed = base.interpolateSpeed(position);
        if (speed <= capacitySpeedLimit)
            return res;

        var builder = new EnvelopePartBuilder();
        builder.setAttr(EnvelopeProfile.BRAKING);
        var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                builder,
                new SpeedFloor(capacitySpeedLimit),
                new EnvelopeCeiling(base)
        );
        decelerate(context, position, speed, overlayBuilder, 1);
        var decelerationPart = builder.build();
        res.add(decelerationPart.slice(base.getBeginPos(), base.getEndPos()));
        return res;
    }

    private List<EnvelopePart> generateAccelerationParts(Envelope base) {
        var res = new ArrayList<EnvelopePart>();
        var position = moveBackwardsUntilNotAccelerating(base, base.getEndPos());
        assert position >= 0 : "We can't lose time in an area where we are always accelerating";
        if (position < base.getEndPos())
            res.addAll(Arrays.asList(base.slice(position, base.getEndPos())));
        if (position > base.getEndPos())
            return res;
        var speed = base.interpolateSpeed(position);
        if (speed <= capacitySpeedLimit)
            return res;

        var partBuilder = new EnvelopePartBuilder();
        partBuilder.setAttr(EnvelopeProfile.ACCELERATING);
        var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                partBuilder,
                new SpeedFloor(capacitySpeedLimit),  // 0
                new EnvelopeCeiling(base)  // 1
        );

        accelerate(context, position, speed, overlayBuilder, -1);
        var acceleratingPart = partBuilder.build();
        res.add(acceleratingPart.slice(base.getBeginPos(), base.getEndPos()));
        return res;
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
        var totalBuilder = new EnvelopeBuilder();

        // Add preceding parts
        var partsBefore = base.slice(Double.NEGATIVE_INFINITY, sectionBegin);
        for (var part : partsBefore)
            totalBuilder.addPart(part);

        // Loop to decompose the envelope between stops
        var cursor = sectionBegin;
        for (var envelopePart : base) {
            if (envelopePart.getEndSpeed() != 0)
                continue;
            var stopPosition = envelopePart.getEndPos();
            if (stopPosition <= sectionBegin)
                continue;
            if (stopPosition >= sectionEnd)
                break;

            applyMarecoToSection(base, totalBuilder, cursor, stopPosition);
            cursor = stopPosition;
        }
        // Handle last section
        applyMarecoToSection(base, totalBuilder, cursor, sectionEnd);

        // Add following parts
        var partsAfter = base.slice(sectionEnd, Double.POSITIVE_INFINITY);
        for (var part : partsAfter)
            totalBuilder.addPart(part);
        return totalBuilder.build();
    }

    private double getTotalTime(Envelope base) {
        return base.interpolateTotalTime(sectionEnd) - base.interpolateTotalTime(sectionBegin);
    }

    private void applyMarecoToSection(Envelope base, EnvelopeBuilder totalBuilder, double begin, double end) {
        var newBase = Envelope.make(base.slice(begin, end));
        var physicalLimits = generatePhysicalLimits(newBase);
        var search = initializeBinarySearch(newBase, getTotalTime(base));
        // loop to run binarySearch for this ROI
        var resultEnvelope = binarySearchLoop(search, newBase, physicalLimits);
        for (int i = 0; i < resultEnvelope.size(); i++)
            totalBuilder.addPart(resultEnvelope.get(i));
    }

    private DoubleBinarySearch initializeBinarySearch(Envelope section, double totalTime) {
        var targetTime = computeTargetTime(section, totalTime);
        var initialHighBound = getFirstHighEstimate(section) * 1.05;
        return new DoubleBinarySearch(0, initialHighBound, targetTime, context.timeStep, true);
    }

    private double computeTargetTime(Envelope section, double totalTime) {
        var sectionTime = section.getTotalTime();
        var sectionDistance = section.getEndPos() - section.getBeginPos();
        var totalDistance = sectionEnd - sectionBegin;
        var targetTime = sectionTime + allowanceValue.getSectionAllowanceTime(
                sectionTime, totalTime, sectionDistance, totalDistance);
        logger.debug("section time {}, trying to get to {}", sectionTime, targetTime);
        return targetTime;
    }

    private Envelope binarySearchLoop(DoubleBinarySearch search,
                                      Envelope base,
                                      List<EnvelopePart> physicalLimits) {
        Envelope curEnvelope = base;
        for (int i = 1; i < 21 && !search.complete(); i++) {
            var input = search.getInput();
            logger.debug("starting attempt {} with v1 = {}", i, input);
            curEnvelope = getEnvelope(base, physicalLimits, input);
            var output = curEnvelope.getTotalTime();
            logger.debug("envelope time {}", output);
            search.feedback(output);
        }
        if (!search.complete())
            throw makeMarecoError(search);

        return curEnvelope;
    }

    private static RuntimeException makeMarecoError(DoubleBinarySearch search) {
        String error;
        if (!search.hasRaisedLowBound())
            error = "we can't lose the requested time in this setting";
        else if (!search.hasLoweredHighBound())
            error = "we can't go fast enough in this setting"; // Should not happen in normal settings
        else
            error = "discontinuity in the search space"; // Should not happen in normal settings
        return new RuntimeException(String.format("Mareco simulation did not converge (%s)", error));
    }
}
