package fr.sncf.osrd.envelope_sim.allowances;

import fr.sncf.osrd.envelope.*;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.allowances.mareco_impl.AcceleratingSlopeCoast;
import fr.sncf.osrd.envelope_sim.allowances.mareco_impl.BrakingPhaseCoast;
import fr.sncf.osrd.envelope_sim.allowances.mareco_impl.CoastingOpportunity;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import java.util.*;

public class MarecoAllowance extends AbstractAllowanceWithRanges {

    /** Constructor */
    public MarecoAllowance(
            EnvelopeSimContext context,
            double beginPos,
            double endPos,
            double capacitySpeedLimit,
            List<AllowanceRange> ranges
    ) {
        super(context, beginPos, endPos, capacitySpeedLimit, ranges);
    }

    public static final class MarecoSpeedLimit implements EnvelopeAttr {
        private MarecoSpeedLimit() {
        }

        @Override
        public Class<? extends EnvelopeAttr> getAttrType() {
            return MarecoSpeedLimit.class;
        }
    }

    /** Given a ceiling speed v1 compute vf, the speed at which the train should end coasting and start braking */
    private double computeVf(double v1) {
        // formulas given by MARECO
        var wle = v1 * v1 * context.rollingStock.getRollingResistanceDeriv(v1);
        return wle * v1 / (wle + context.rollingStock.getRollingResistance(v1) * v1);
    }

    /** Compute the initial low bound for the binary search */
    @Override
    protected double computeInitialLowBound(Envelope envelopeSection) {
        return capacitySpeedLimit;
    }

    /** Compute the initial high bound for the binary search
     *  The high bound ensures that the speed vf will be higher than the max speed of the envelope */
    @Override
    protected double computeInitialHighBound(Envelope envelopeSection) {
        var sectionMaxSpeed = envelopeSection.getMaxSpeed();
        var maxSpeed = sectionMaxSpeed;
        var vf = computeVf(maxSpeed);
        while (vf < sectionMaxSpeed) {
            maxSpeed = maxSpeed * 2;
            vf = computeVf(maxSpeed);
        }
        return maxSpeed;
    }


    /** Compute the core of Mareco algorithm.
     *  This algorithm consists of a speed cap at v1 and several coasting opportunities
     *  before braking or before accelerating slopes for example. */
    @Override
    protected Envelope computeCore(Envelope coreBase, double v1) {
        double vf = computeVf(v1);

        // 1) cap the core base envelope at v1
        var cappedEnvelope = EnvelopeSpeedCap.from(coreBase, List.of(new MarecoSpeedLimit()), v1);

        // 2) find accelerating slopes on constant speed limit regions
        var coastingOpportunities = new ArrayList<CoastingOpportunity>();
        coastingOpportunities.addAll(AcceleratingSlopeCoast.findAll(cappedEnvelope, context, vf));

        // 3) find coasting opportunities related to braking
        coastingOpportunities.addAll(BrakingPhaseCoast.findAll(cappedEnvelope, v1, vf));

        // 4) evaluate coasting opportunities in reverse order, thus skipping overlapping ones
        coastingOpportunities.sort(Comparator.comparing(CoastingOpportunity::getEndPosition));
        Collections.reverse(coastingOpportunities);

        var builder = OverlayEnvelopeBuilder.backward(cappedEnvelope);
        double lastCoastBegin = Double.POSITIVE_INFINITY;
        for (var opportunity : coastingOpportunities) {
            if (lastCoastBegin < opportunity.getEndPosition())
                continue;
            var overlay = opportunity.compute(cappedEnvelope, context, v1, vf);
            if (overlay == null)
                continue;
            lastCoastBegin = overlay.getBeginPos();
            builder.addPart(overlay);
        }

        var res = builder.build();
        // check for continuity of the core phase
        assert res.continuous : "Discontinuity in MARECO core phase";
        return res;
    }
}
