package fr.sncf.osrd.envelope_sim.allowances;

import com.carrotsearch.hppc.DoubleArrayList;
import fr.sncf.osrd.envelope.*;
import fr.sncf.osrd.envelope.constraint.ConstrainedEnvelopePartBuilder;
import fr.sncf.osrd.envelope.constraint.SpeedFloor;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.allowances.mareco_impl.BrakingPhaseCoast;
import fr.sncf.osrd.envelope_sim.allowances.mareco_impl.CoastingOpportunity;
import fr.sncf.osrd.envelope_sim.allowances.mareco_impl.AcceleratingSlopeCoast;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeAcceleration;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration;
import fr.sncf.osrd.utils.DoubleBinarySearch;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

public class HardenedMarecoAllowance implements Allowance {
    private final Logger logger = LoggerFactory.getLogger(HardenedMarecoAllowance.class);

    public final EnvelopeSimContext context;

    public final double beginPos;
    public final double endPos;

    public final AllowanceValue allowanceValue;

    // potential speed limit under which the train would use too much capacity
    public final double capacitySpeedLimit;

    /** Constructor */
    public HardenedMarecoAllowance(
            EnvelopeSimContext context,
            double beginPos,
            double endPos,
            double capacitySpeedLimit,
            AllowanceValue allowanceValue
    ) {
        this.context = context;
        this.beginPos = beginPos;
        this.endPos = endPos;
        this.capacitySpeedLimit = capacitySpeedLimit;
        this.allowanceValue = allowanceValue;
    }

    private Envelope intersectSlowdownSpeedup(EnvelopePart slowdown, EnvelopePart speedup) {
        // TODO: implement
        return null;
    }

    public static final class MarecoSpeedLimit implements EnvelopeAttr {
        private MarecoSpeedLimit() {
        }

        @Override
        public Class<? extends EnvelopeAttr> getAttrType() {
            return MarecoSpeedLimit.class;
        }
    }

    private double computeVf(double v1) {
        // formulas given by MARECO
        var wle = v1 * v1 * context.rollingStock.getRollingResistanceDeriv(v1);
        return wle * v1 / (wle + context.rollingStock.getRollingResistance(v1) * v1);
    }

    private Envelope computeMarecoCore(Envelope coreBase, double v1) {
        double vf = computeVf(v1);

        // 1) cap the core base envelope at v1
        var cappedEnvelope = EnvelopeSpeedCap.from(coreBase, List.of(new MarecoSpeedLimit()), v1);

        // 2) find accelerating slopes on constant speed limit regions
        var coastingOpportunities = new ArrayList<CoastingOpportunity>();
        coastingOpportunities.addAll(AcceleratingSlopeCoast.findAll(cappedEnvelope, context, vf));

        // 3) find coasting opportunities related to braking
        coastingOpportunities.addAll(BrakingPhaseCoast.findAll(cappedEnvelope, v1, vf));

        // 4) evaluate coasting opportunities in reverse order, skipping overlapping ones
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
        assert res.continuous;
        return res;
    }

    private EnvelopePart computeSlowdown(Envelope base, double v1) {
        var startSpeed = base.getBeginSpeed();
        if (startSpeed <= v1)
            return null;

        var partBuilder = new EnvelopePartBuilder();
        var constrainedBuilder = new ConstrainedEnvelopePartBuilder(
                partBuilder,
                new SpeedFloor(v1)
        );
        EnvelopeDeceleration.decelerate(context, base.getBeginPos(), startSpeed, constrainedBuilder, 1);
        return partBuilder.build();
    }

    private EnvelopePart computeSpeedup(Envelope base, double v1) {
        var endSpeed = base.getEndSpeed();
        if (endSpeed <= v1)
            return null;

        var partBuilder = new EnvelopePartBuilder();
        var constrainedBuilder = new ConstrainedEnvelopePartBuilder(
                partBuilder,
                new SpeedFloor(v1)
        );
        EnvelopeAcceleration.accelerate(context, base.getEndPos(), endSpeed, constrainedBuilder, -1);
        return partBuilder.build();
    }

    private Envelope computeMarecoIteration(Envelope base, double v1) {
        // The part of the envelope on which the margin is applied is split in 3:
        // slowdown, then core, then speedup. The slowdown / speedup parts are needed to transition to / from v1 when
        // the begin / end speeds are above v1. These phases are empty / can be ignored when the begin / end speeds
        // are below v1.

        // 1) compute the slowdown and speedup regions, so that the rest of this function can assume all speeds are
        // below v1
        var slowdownPhase = computeSlowdown(base, v1);
        var speedupPhase = computeSpeedup(base, v1);
        var slowdownEnd = slowdownPhase != null ? slowdownPhase.getEndPos() : base.getBeginPos();
        var speedupBegin = speedupPhase != null ? speedupPhase.getBeginPos() : base.getEndPos();

        // if the slowdown / speedup phases touch or intersect, there is no core phase
        if (speedupBegin < slowdownEnd)
            return intersectSlowdownSpeedup(slowdownPhase, speedupPhase);
        if (speedupBegin == slowdownEnd)
            return Envelope.make(slowdownPhase, speedupPhase);

        // otherwise, compute the core phase
        var coreBase = Envelope.make(base.slice(slowdownEnd, speedupBegin));
        var corePhase = computeMarecoCore(coreBase, v1);

        // 2) stick phases back together
        var builder = new EnvelopeBuilder();
        if (slowdownPhase != null)
            builder.addPart(slowdownPhase);
        builder.addEnvelope(corePhase);
        if (speedupPhase != null)
            builder.addPart(speedupPhase);
        var result = builder.build();

        // 3) check for continuity
        assert result.continuous;
        return result;
    }

    /** Iteratively run MARECO on the given envelope, until the target time is reached */
    private Envelope computeMareco(Envelope base, double targetTime) {
        // perform a binary search
        // low bound: capacitySpeedLimit
        // high bound: compute v1 for which vf is the max speed of the envelope region
        var initialHighBound = base.getMaxSpeed() * 2;

        Envelope marecoResult = null;
        var search = new DoubleBinarySearch(capacitySpeedLimit, initialHighBound, targetTime, context.timeStep, true);
        for (int i = 1; i < 21 && !search.complete(); i++) {
            var v1 = search.getInput();
            logger.debug("starting attempt {} with v1 = {}", i, v1);
            marecoResult = computeMarecoIteration(base, v1);
            var regionTime = marecoResult.getTotalTime();
            logger.debug("envelope time {}", regionTime);
            search.feedback(regionTime);
        }
        assert marecoResult != null;

        if (!search.complete())
            throw makeMarecoError(search);
        return marecoResult;
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

    private DoubleArrayList findStops(Envelope base) {
        var res = new DoubleArrayList();
        for (var envelopePart : base) {
            // skips envelope parts which aren't stops
            if (envelopePart.getEndSpeed() != 0)
                continue;
            res.add(envelopePart.getEndPos());
        }
        return res;
    }

    /**
     * Apply the allowance to the region affected by the allowance.
     * Split the region into section which can be independently computed.
     */
    private void applyAllowanceRegion(EnvelopeBuilder builder, Envelope allowanceRegion, double addedTime) {
        var baseTime = allowanceRegion.getTotalTime();
        var baseDistance = allowanceRegion.getTotalDistance();

        // TODO: compute the slowest possible trip, and ensure the target time is within the realms of possibility

        // build a list of point between which the computation is divided
        // each division is a section
        var splitPoints = new DoubleArrayList();
        splitPoints.add(allowanceRegion.getBeginPos());
        splitPoints.addAll(findStops(allowanceRegion));
        if (splitPoints.get(splitPoints.size() - 1) != allowanceRegion.getEndPos())
            splitPoints.add(allowanceRegion.getEndPos());

        // run mareco on each section of the allowance region
        for (int i = 0; i < splitPoints.size() - 1; i++) {
            double sectionBegin = splitPoints.get(i);
            double sectionEnd = splitPoints.get(i + 1);
            var section = Envelope.make(allowanceRegion.slice(sectionBegin, sectionEnd));
            var sectionTime = section.getTotalTime();
            var sectionDistance = section.getTotalDistance();
            var sectionRatio = allowanceValue.distribution.getSectionRatio(
                    sectionTime, baseTime, sectionDistance, baseDistance);
            var targetTime = sectionTime + addedTime * sectionRatio;
            var marecoResult = computeMareco(section, targetTime);
            builder.addEnvelope(marecoResult);
        }
    }

    /** Apply the allowance to the entire envelope. */
    @Override
    public Envelope apply(Envelope base) {
        assert base.continuous;

        // get only the region on which the allowance applies
        var region = Envelope.make(base.slice(beginPos, endPos));

        // compute the added time for all the allowance region
        var distance = endPos - beginPos;
        var allowanceAddedTime = allowanceValue.getAllowanceTime(region.getTotalTime(), distance);
        // if no time is added, just return the base envelope without performing binary search
        if (allowanceAddedTime == 0.0)
            return base;
        assert allowanceAddedTime > 0;

        // run the allowance algorithm on the
        var builder = new EnvelopeBuilder();
        builder.addParts(base.slice(Double.NEGATIVE_INFINITY, beginPos));
        applyAllowanceRegion(builder, region, allowanceAddedTime);
        builder.addParts(base.slice(endPos, Double.POSITIVE_INFINITY));
        var res = builder.build();
        assert res.continuous;
        return res;
    }
}
