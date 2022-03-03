package fr.sncf.osrd.envelope_sim.allowances.mareco_impl;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeCursor;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;

import java.util.ArrayList;

/** Encodes metadata about an accelerating slope on a plateau */
public class AcceleratingSlopeCoast implements CoastingOpportunity {
    private double endPos;

    /** Average acceleration of the train during the slope */
    private double slopeAverageAcceleration;

    /** An estimate of the average acceleration of the train
     * from the start of coasting to the beginning of the accelerating slope */
    private double previousAccelerationEstimate;

    /** The start and end speed limit of the accelerating slope */
    private double speedLimit;

    private AcceleratingSlopeCoast(
            double endPos,
            double slopeAverageAcceleration,
            double previousAccelerationEstimate,
            double speedLimit
    ) {
        this.endPos = endPos;
        this.slopeAverageAcceleration = slopeAverageAcceleration;
        this.previousAccelerationEstimate = previousAccelerationEstimate;
        this.speedLimit = speedLimit;
    }

    @Override
    public double getEndPosition() {
        return endPos;
    }

    private double computeV(PhysicsRollingStock rollingStock, double v1, double vf) {
        // formulas given my MARECO
        // giving the optimized speed v the train should have when entering the accelerating slope
        // this speed v might not be reached if the slope is not long enough, then we just enter the slope with
        // the lowest possible speed that will catch up with target speed at the end
        double wle = rollingStock.getRollingResistance(v1) * v1 * vf / (v1 - vf);
        double accelRatio = previousAccelerationEstimate / slopeAverageAcceleration;
        return 1 / (1 / speedLimit + rollingStock.getRollingResistance(speedLimit) / (wle * (1 - accelRatio)));
    }

    @Override
    public EnvelopePart compute(
            Envelope base,
            EnvelopeSimContext context,
            double v1,
            double vf
    ) {
        // for constant speed limit accelerating slopes, compute the minimum speed v for this coasting opportunity,
        // coast backwards from the end of accelerating slope, limiting the minimum speed to v. Then coasting forward
        // from the point reached by the backward coasting
        // TODO: it turns out that v depends on the average acceleration of the deceleration part of the coasting
        //       result. it should be probably be iteratively computed.

        double v = computeV(context.rollingStock, v1, vf);
        return CoastingGenerator.coastFromEnd(base, context, endPos, v);
    }

    // TODO: rewrite as a method of the physics path
    /** Finds all the opportunities for coasting on accelerating slopes */
    public static ArrayList<AcceleratingSlopeCoast> findAll(
            Envelope envelope,
            EnvelopeSimContext context,
            double vf
    ) {
        var res = new ArrayList<AcceleratingSlopeCoast>();
        double previousPosition = 0.0;
        double previousAcceleration = 0.0;
        double meanAcceleration = 0.0;
        double accelerationLength = 0.0;
        var currentAcceleratingSlope = new AcceleratingSlopeCoast(0, 0, 0, 0);
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
                    if (previousAcceleration < 0)
                        currentAcceleratingSlope.previousAccelerationEstimate = previousAcceleration;
                } else if (naturalAcceleration <= 0 && accelerationLength > 0) {
                    // end the accelerating slope
                    currentAcceleratingSlope.endPos = previousPosition;
                    currentAcceleratingSlope.speedLimit = speed;
                    meanAcceleration /= accelerationLength;
                    currentAcceleratingSlope.slopeAverageAcceleration = meanAcceleration;
                    res.add(currentAcceleratingSlope);
                    // reset meanAcceleration, accelerationLength, and accelerating slope
                    meanAcceleration = 0;
                    accelerationLength = 0;
                    currentAcceleratingSlope = new AcceleratingSlopeCoast(0, 0, 0, 0);
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
                currentAcceleratingSlope.endPos = previousPosition;
                currentAcceleratingSlope.speedLimit = speed;
                meanAcceleration /= accelerationLength;
                currentAcceleratingSlope.slopeAverageAcceleration = meanAcceleration;
                res.add(currentAcceleratingSlope);
                // reset meanAcceleration, accelerationLength, and accelerating slope
                meanAcceleration = 0;
                accelerationLength = 0;
                currentAcceleratingSlope = new AcceleratingSlopeCoast(0, 0, 0, 0);
            }
        }
        return res;
    }
}
