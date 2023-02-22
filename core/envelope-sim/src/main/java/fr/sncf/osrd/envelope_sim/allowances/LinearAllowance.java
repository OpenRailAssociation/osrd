package fr.sncf.osrd.envelope_sim.allowances;

import fr.sncf.osrd.envelope.*;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import java.util.*;

public class LinearAllowance extends AbstractAllowanceWithRanges {

    /** Constructor */
    public LinearAllowance(
            EnvelopeSimContext context,
            double beginPos,
            double endPos,
            double capacitySpeedLimit,
            List<AllowanceRange> ranges
    ) {
        super(context, beginPos, endPos, capacitySpeedLimit, ranges);
    }

    /** Compute the initial low bound for the binary search */
    @Override
    protected double computeInitialLowBound(Envelope envelopeSection) {
        return capacitySpeedLimit;
    }

    /** Compute the initial high bound for the binary search */
    @Override
    protected double computeInitialHighBound(Envelope envelopeSection) {
        return envelopeSection.getMaxSpeed();
    }

    /** Compute the core of linear allowance algorithm.
     *  This algorithm consists of a ratio that scales speeds */
    @Override
    protected Envelope computeCore(Envelope coreBase, double maxSpeed) {
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
        var positions = part.clonePositions();
        var speeds = part.cloneSpeeds();
        var scaledSpeeds = Arrays.stream(speeds)
                .map(x -> x * ratio)
                .toArray();
        var attr = part.getAttr(EnvelopeProfile.class);
        var attrs = List.<EnvelopeAttr>of();
        if (attr != null)
            attrs = List.of(attr);
        return EnvelopePart.generateTimes(
                attrs,
                positions,
                scaledSpeeds
        );
    }
}
