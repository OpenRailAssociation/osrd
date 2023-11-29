package fr.sncf.osrd.envelope_sim.allowances;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.*;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.envelope_sim.allowances.mareco_impl.AcceleratingSlopeCoast;
import fr.sncf.osrd.envelope_sim.allowances.mareco_impl.BrakingPhaseCoast;
import fr.sncf.osrd.envelope_sim.allowances.mareco_impl.CoastingOpportunity;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import java.util.*;

public class MarecoAllowance extends AbstractAllowanceWithRanges {

    /** Constructor */
    public MarecoAllowance(
            double beginPos,
            double endPos,
            double capacitySpeedLimit,
            List<AllowanceRange> ranges
    ) {
        super(beginPos, endPos, capacitySpeedLimit, ranges);
        assert capacitySpeedLimit >= 1 : "capacity speed limit can't be lower than 1m/s for mareco allowances";
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
    private double computeVf(double v1, PhysicsRollingStock rollingStock) {
        // formulas given by MARECO
        var wle = v1 * v1 * rollingStock.getRollingResistanceDeriv(v1);
        var vf = wle * v1 / (wle + rollingStock.getRollingResistance(v1) * v1);

        return Math.max(vf, capacitySpeedLimit); // Prevents coasting from starting below capacity speed limit
    }

    /** Compute the initial low bound for the binary search */
    @Override
    protected double computeInitialLowBound(Envelope envelopeSection) {
        return capacitySpeedLimit;
    }

    /** Compute the initial high bound for the binary search
     *  The high bound ensures that the speed vf will be higher than the max speed of the envelope */
    @Override
    @SuppressFBWarnings("FL_FLOATS_AS_LOOP_COUNTERS")
    protected double computeInitialHighBound(Envelope envelopeSection, PhysicsRollingStock rollingStock) {
        var sectionMaxSpeed = envelopeSection.getMaxSpeed();
        var maxSpeed = sectionMaxSpeed;
        var vf = computeVf(maxSpeed, rollingStock);
        while (vf < sectionMaxSpeed) {
            maxSpeed = maxSpeed * 2;
            vf = computeVf(maxSpeed, rollingStock);
        }
        return maxSpeed;
    }


    /** Compute the core of Mareco algorithm.
     *  This algorithm consists of a speed cap at v1 and several coasting opportunities
     *  before braking or before accelerating slopes for example. */
    @Override
    protected Envelope computeCore(Envelope coreBase, EnvelopeSimContext context, double v1) {
        double vf = computeVf(v1, context.rollingStock);

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
