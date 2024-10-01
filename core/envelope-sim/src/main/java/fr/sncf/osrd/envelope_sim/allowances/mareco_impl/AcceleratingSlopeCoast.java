package fr.sncf.osrd.envelope_sim.allowances.mareco_impl;

import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.arePositionsEqual;
import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.areSpeedsEqual;
import static java.lang.Double.NaN;
import static java.lang.Math.max;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeCursor;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope_sim.Action;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_utils.DistanceAverage;
import java.util.ArrayList;

/** Encodes metadata about an accelerating slope on a plateau */
public class AcceleratingSlopeCoast implements CoastingOpportunity {
    /** Position where the coasting envelope should merge back into the base envelope */
    private double endPos = NaN;

    /** Average acceleration of the train during the slope */
    private double slopeAverageAcceleration = NaN;

    /**
     * An estimate of the average acceleration of the train from the start of coasting to the
     * beginning of the accelerating slope
     */
    private double previousAccelerationEstimate = NaN;

    /** Position where the train starts accelerating again until it reaches the max speed */
    private final double accelerationStartPosition;

    /** The start and end speed limit of the accelerating slope */
    private final double speedLimit;

    /** Used to compute the mean acceleration over the accelerating slope */
    private final DistanceAverage meanAccelerationBuilder = new DistanceAverage();

    private AcceleratingSlopeCoast(double accelerationStartPosition, double speedLimit) {
        this.accelerationStartPosition = accelerationStartPosition;
        this.speedLimit = speedLimit;
    }

    /** Finish building the slope instance, once we know the end position */
    private AcceleratingSlopeCoast build(double endPos, EnvelopeSimContext context) {
        this.slopeAverageAcceleration = meanAccelerationBuilder.getAverage();
        this.previousAccelerationEstimate = estimatePreviousAcceleration(context);
        this.endPos = endPos;
        assert !Double.isNaN(slopeAverageAcceleration);
        assert !Double.isNaN(endPos);
        assert !Double.isNaN(previousAccelerationEstimate);
        assert !Double.isNaN(speedLimit);
        return this;
    }

    /** Estimates the average acceleration during the part where the train decelerates */
    private double estimatePreviousAcceleration(EnvelopeSimContext context) {
        // We look for the natural acceleration an offset before the start of the slope.
        // The exact offset is arbitrary, we only need an approximation
        // (as long as there is no discontinuity in the binary search).
        // It still needs to be fairly large as the train covers a wide area.
        // We use the train length to make sure the head of the train isn't on the slope.
        var accelerationStart = findExactStartAcceleratingSlope(context);
        var offset = context.rollingStock.getLength();
        var estimatePosition = max(0, accelerationStart - offset);
        return Math.min(0, getNaturalAcceleration(context, estimatePosition, speedLimit));
    }

    /**
     * Returns the exact position where the natural acceleration sign goes from negative to positive
     */
    private double findExactStartAcceleratingSlope(EnvelopeSimContext context) {
        // We do this by starting from the first position with a positive acceleration,
        // and we go back until it's negative. We may go back for more than one step if the part
        // started in a slope.

        double positionStep = 10; // Because we interpolate, there's no need for a small step
        var position = accelerationStartPosition;
        while (position > 0 && getNaturalAcceleration(context, position, speedLimit) > 0) position -= positionStep;
        if (position <= 0) return 0; // The path is on a negative slope from its start
        var accelerationPrevStep = getNaturalAcceleration(context, position, speedLimit);
        var accelerationNextStep = getNaturalAcceleration(context, position + positionStep, speedLimit);
        assert accelerationPrevStep <= 0;
        assert accelerationNextStep >= 0;
        return interpolateAccelerationSignChange(
                accelerationNextStep, accelerationPrevStep, position + positionStep, position);
    }

    @Override
    public double getEndPosition() {
        return endPos;
    }

    private double computeV(PhysicsRollingStock rollingStock, double v1, double vf) {
        // formulas given my MARECO
        // giving the optimized speed v the train should have when entering the accelerating slope
        // this speed v might not be reached if the slope is not long enough, then we just enter the
        // slope with
        // the lowest possible speed that will catch up with target speed at the end
        double wle = rollingStock.getRollingResistance(v1) * v1 * vf / (v1 - vf);
        double accelRatio = previousAccelerationEstimate / slopeAverageAcceleration;
        assert accelRatio <= 0;
        return 1 / (1 / speedLimit + rollingStock.getRollingResistance(speedLimit) / (wle * (1 - accelRatio)));
    }

    @Override
    public EnvelopePart compute(Envelope base, EnvelopeSimContext context, double v1, double vf) {
        // for constant speed limit accelerating slopes, compute the minimum speed v for this
        // coasting opportunity,
        // coast backwards from the end of accelerating slope, limiting the minimum speed to v. Then
        // coasting forward
        // from the point reached by the backward coasting
        // TODO: it turns out that v depends on the average acceleration of the deceleration part of
        // the coasting
        //       result. it should be probably be iteratively computed.

        double v = computeV(context.rollingStock, v1, vf);
        double minCoastingSpeed = max(v, vf); // We don't want to coast below vf nor v
        return CoastingGenerator.coastFromEnd(base, context, endPos, minCoastingSpeed);
    }

    // TODO: rewrite as a method of the physics path
    /** Finds all the opportunities for coasting on accelerating slopes */
    public static ArrayList<AcceleratingSlopeCoast> findAll(Envelope envelope, EnvelopeSimContext context, double vf) {
        var res = new ArrayList<AcceleratingSlopeCoast>();
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

            double previousPosition = NaN;
            double previousAcceleration = NaN;
            AcceleratingSlopeCoast currentAcceleratingSlope = null;

            // constant variables for this plateau
            var envelopePart = cursor.getPart();
            var positionStep = context.timeStep * speed;

            while (!cursor.hasReachedEnd() && cursor.getPosition() <= envelopePart.getEndPos()) {
                double position = cursor.getPosition();
                double naturalAcceleration = getNaturalAcceleration(context, position, speed);
                if (naturalAcceleration > 0) {
                    // Accelerating slope
                    if (currentAcceleratingSlope == null)
                        currentAcceleratingSlope = new AcceleratingSlopeCoast(position, speed);
                    currentAcceleratingSlope.meanAccelerationBuilder.addSegment(positionStep, naturalAcceleration);
                } else if (currentAcceleratingSlope != null) {
                    // end the accelerating slope
                    var endPos = interpolateAccelerationSignChange(
                            naturalAcceleration, previousAcceleration,
                            position, previousPosition);
                    res.add(currentAcceleratingSlope.build(endPos, context));
                    currentAcceleratingSlope = null; // reset the accelerating slope
                }
                previousAcceleration = naturalAcceleration;
                previousPosition = position;
                cursor.findPosition(position + positionStep);
            }
            // if the end of the plateau is an accelerating slope
            if (currentAcceleratingSlope != null) res.add(currentAcceleratingSlope.build(previousPosition, context));
        }
        return res;
    }

    /** Returns acceleration at the given position if the train coasts */
    private static double getNaturalAcceleration(EnvelopeSimContext context, double position, double speed) {
        return TrainPhysicsIntegrator.step(context, position, speed, Action.COAST, 1).acceleration;
    }

    /** Interpolate the exact position where the natural acceleration is 0 */
    private static double interpolateAccelerationSignChange(
            double currentAcceleration, double previousAcceleration, double currentPosition, double previousPosition) {
        assert !Double.isNaN(previousAcceleration);
        if (arePositionsEqual(currentPosition, previousPosition)) return currentPosition;
        if (areSpeedsEqual(currentAcceleration, previousAcceleration)) return currentPosition;
        double factor = (previousAcceleration - currentAcceleration) / (previousPosition - currentPosition);
        double y0 = previousAcceleration - factor * previousPosition;
        var res = -y0 / factor;
        assert previousPosition <= res && res <= currentPosition;
        return res;
    }
}
