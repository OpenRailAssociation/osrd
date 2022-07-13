package fr.sncf.osrd.envelope_sim.allowances;

import fr.sncf.osrd.envelope.*;
import fr.sncf.osrd.envelope.part.EnvelopePart;
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
        var builder = new EnvelopeBuilder();
        for (var i = 0; i < coreBase.size(); i++) {
            var part = coreBase.get(i);
            var positions = part.clonePositions();
            var speeds = part.cloneSpeeds();
            var scaledSpeeds = Arrays.stream(speeds)
                    .map(x -> x * ratio)
                    .toArray();
            var scaledPart = EnvelopePart.generateTimes(positions, scaledSpeeds);
            builder.addPart(scaledPart);
        }
        return builder.build();
    }
}
