package fr.sncf.osrd.envelope_sim.allowances;

import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.POSITION_EPSILON;

import fr.sncf.osrd.envelope.*;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import java.util.*;

public class LinearAllowance extends AbstractAllowanceWithRanges {

    /** Constructor */
    public LinearAllowance(
            double beginPos,
            double endPos,
            double capacitySpeedLimit,
            List<AllowanceRange> ranges
    ) {
        super(beginPos, endPos, capacitySpeedLimit, ranges);
    }

    /** Compute the initial low bound for the binary search */
    @Override
    protected double computeInitialLowBound(Envelope envelopeSection) {
        return capacitySpeedLimit;
    }

    /** Compute the initial high bound for the binary search */
    @Override
    protected double computeInitialHighBound(Envelope envelopeSection, PhysicsRollingStock rollingStock) {
        return envelopeSection.getMaxSpeed();
    }

    /** Compute the core of linear allowance algorithm.
     *  This algorithm consists of a ratio that scales speeds */
    @Override
    protected Envelope computeCore(Envelope coreBase, EnvelopeSimContext context, double maxSpeed) {
        var ratio = maxSpeed / coreBase.getMaxSpeed();
        return scaleEnvelope(coreBase, ratio);
    }

    /** Scale an envelope, new speed = old speed * ratio */
    public static Envelope scaleEnvelope(Envelope envelope, double ratio) {
        var builder = new EnvelopeBuilder();
        for (var part : envelope)
            builder.addPart(scalePart(part, ratio));
        return builder.build();
    }

    /** Scale a single part, new speed = old speed * ratio */
    private static EnvelopePart scalePart(EnvelopePart part, double ratio) {
        var positions = new ArrayList<Double>();
        var speeds = new ArrayList<Double>();
        for (int i = 0; i < part.pointCount(); i++) {
            if (i > 0 && Math.abs(positions.get(i - 1) - part.getPointPos(i)) < POSITION_EPSILON) {
                // Remove points that are too close to one another, could cause problems with scaling down
                // The first one is removed to keep the same values at the end of the envelope
                positions.remove(positions.size() - 1);
                speeds.remove(speeds.size() - 1);
            }
            positions.add(part.getPointPos(i));
            speeds.add(part.getPointSpeed(i) * ratio);
        }
        var attr = part.getAttr(EnvelopeProfile.class);
        var attrs = List.<EnvelopeAttr>of();
        if (attr != null)
            attrs = List.of(attr);
        return EnvelopePart.generateTimes(
                attrs,
                positions.stream().mapToDouble(x -> x).toArray(),
                speeds.stream().mapToDouble(x -> x).toArray()
        );
    }
}
