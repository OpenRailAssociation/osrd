package fr.sncf.osrd.envelope_sim.allowances;

import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.CEILING;
import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.FLOOR;
import static java.lang.Double.NaN;
import static java.lang.Math.abs;

import com.carrotsearch.hppc.DoubleArrayList;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeAttr;
import fr.sncf.osrd.envelope.EnvelopeBuilder;
import fr.sncf.osrd.envelope.EnvelopeSpeedCap;
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint;
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraint;
import fr.sncf.osrd.envelope.part.constraints.PositionConstraint;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceConvergenceException;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeAcceleration;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration;
import fr.sncf.osrd.utils.DoubleBinarySearch;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

public abstract class AbstractAllowanceWithRanges implements Allowance {

    public final Logger logger = LoggerFactory.getLogger(Allowance.class);

    public final EnvelopeSimContext context;

    public final double beginPos;
    public final double endPos;

    public final List<AllowanceRange> ranges;

    // potential speed limit under which the train would use too much capacity
    public final double capacitySpeedLimit;

    protected AbstractAllowanceWithRanges(
            EnvelopeSimContext context,
            double beginPos,
            double endPos,
            double capacitySpeedLimit,
            List<AllowanceRange> ranges
    ) {
        this.context = context;
        this.beginPos = beginPos;
        this.endPos = endPos;
        this.capacitySpeedLimit = capacitySpeedLimit;
        this.ranges = ranges;
    }

    protected abstract Envelope computeCore(Envelope base, double parameter);

    protected abstract double computeInitialHighBound(Envelope envelopeSection);

    protected abstract double computeInitialLowBound(Envelope envelopeSection);

    public static final class CapacitySpeedLimit implements EnvelopeAttr {
        private CapacitySpeedLimit() {
        }

        @Override
        public Class<? extends EnvelopeAttr> getAttrType() {
            return CapacitySpeedLimit.class;
        }
    }

    /** Get the total distance the allowance covers */
    public double getDistance() {
        return endPos - beginPos;
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

    private static RuntimeException makeError(DoubleBinarySearch search) {
        if (!search.hasRaisedLowBound())
            throw AllowanceConvergenceException.tooMuchTime();
        else if (!search.hasLoweredHighBound())
            throw AllowanceConvergenceException.notEnoughTime();
        else
            throw AllowanceConvergenceException.discontinuity();
    }

    /** Apply the allowance to a given envelope. */
    @Override
    public Envelope apply(Envelope base) {
        assert base.continuous;

        // get only the region on which the allowance applies
        var region = Envelope.make(base.slice(beginPos, endPos));

        // slice parts that are not modified and run the allowance algorithm on the allowance region
        var builder = new EnvelopeBuilder();
        builder.addParts(base.slice(Double.NEGATIVE_INFINITY, beginPos));
        var allowanceRegion = computeAllowanceRegion(region);
        for (var envelope : allowanceRegion)
            builder.addEnvelope(envelope);
        builder.addParts(base.slice(endPos, Double.POSITIVE_INFINITY));
        var res = builder.build();
        assert res.continuous : "Discontinuity on the edges of the allowance region";
        return res;
    }

    private record RangePercentage(AllowanceRange range, double percentage) {
    }

    /**
     * Apply the allowance to the region affected by the allowance.
     * The region is split in ranges asked by the user and independently computed.
     * Ranges are computed in a specific order : from the lowest to the highest allowance value.
     * Once a range is computed, its beginning and end speeds are memorized
     * and imposed to the left and right side ranges respectively.
     * This process ensures the continuity of the final envelope.
     */
    private Envelope[] computeAllowanceRegion(Envelope envelopeRegion) {

        // build an array of the imposed speeds between ranges
        // every time a range is computed, the imposed left and right speeds are memorized
        var imposedTransitionSpeeds = new double[ranges.size() + 1];
        imposedTransitionSpeeds[0] = envelopeRegion.getBeginSpeed();
        for (int i = 1; i < ranges.size(); i++)
            imposedTransitionSpeeds[i] = NaN;
        imposedTransitionSpeeds[ranges.size()] = envelopeRegion.getEndSpeed();

        // build an array of (range, percentage) in order to sort the array rangeOrder by ascending percentage
        var rangePercentages = new RangePercentage[ranges.size()];
        for (var i = 0; i < ranges.size(); i++) {
            var range = ranges.get(i);
            var percentage = range.value.getAllowanceRatio(
                    envelopeRegion.getTimeBetween(range.beginPos, range.endPos),
                    range.beginPos - range.endPos
            );
            rangePercentages[i] = new RangePercentage(range, percentage);
        }

        // the order in which the ranges should be computed
        // ranges are computed with increasing percentage values
        var rangeOrder = new Integer[ranges.size()];
        for (var i = 0; i < ranges.size(); i++)
            rangeOrder[i] = i;
        Arrays.sort(rangeOrder, Comparator.comparingDouble(rangeIndex -> rangePercentages[rangeIndex].percentage));

        var res = new Envelope[ranges.size()];

        // compute ranges one by one in the right order
        for (var rangeIndex : rangeOrder) {
            var range = ranges.get(rangeIndex);
            logger.debug("computing range n°{}", rangeIndex + 1);
            var envelopeRange = Envelope.make(envelopeRegion.slice(range.beginPos, range.endPos));
            var imposedBeginSpeed = imposedTransitionSpeeds[rangeIndex];
            var imposedEndSpeed = imposedTransitionSpeeds[rangeIndex + 1];
            var allowanceRange =
                    computeAllowanceRange(envelopeRange, range.value, imposedBeginSpeed, imposedEndSpeed);
            // memorize the beginning and end speeds
            imposedTransitionSpeeds[rangeIndex] = allowanceRange.getBeginSpeed();
            imposedTransitionSpeeds[rangeIndex + 1] = allowanceRange.getEndSpeed();
            res[rangeIndex] = allowanceRange;
        }

        return res;
    }

    /**
     * Apply the allowance to the given range.
     * Split the range into sections, separated by stops, which are independently computed.
     */
    private Envelope computeAllowanceRange(Envelope envelopeRange,
                                           AllowanceValue value,
                                           double imposedRangeBeginSpeed,
                                           double imposedRangeEndSpeed) {

        // compute the added time for all the allowance range
        var baseTime = envelopeRange.getTotalTime();
        var baseDistance = envelopeRange.getTotalDistance();
        var addedTime = value.getAllowanceTime(baseTime, baseDistance);
        // if no time is added, just return the base envelope without performing binary search
        if (addedTime == 0.0) {
            return envelopeRange;
        }
        assert addedTime > 0;

        // compute the slowest running time, given the capacity speed limit,
        // to make sure the user asked for a margin that is actually possible
        var totalTargetTime = baseTime + addedTime;
        var slowestRunningTime = Double.POSITIVE_INFINITY;
        if (capacitySpeedLimit > 0) {
            var slowestEnvelope =
                    EnvelopeSpeedCap.from(envelopeRange, List.of(new CapacitySpeedLimit()), capacitySpeedLimit);
            slowestRunningTime = slowestEnvelope.getTotalTime();
        }
        // if the total target time isn't actually reachable, throw error
        if (totalTargetTime > slowestRunningTime)
            throw AllowanceConvergenceException.tooMuchTime();

        var rangeBeginPos = envelopeRange.getBeginPos();
        var rangeEndPos = envelopeRange.getEndPos();

        // build a list of point between which the computation is divided
        // each division is a section
        var splitPoints = new DoubleArrayList();
        splitPoints.add(rangeBeginPos);
        splitPoints.addAll(findStops(envelopeRange));
        if (splitPoints.get(splitPoints.size() - 1) != rangeEndPos)
            splitPoints.add(rangeEndPos);

        var builder = new EnvelopeBuilder();
        // apply the allowance on each section of the allowance range
        for (int i = 0; i < splitPoints.size() - 1; i++) {
            double sectionBeginPos = splitPoints.get(i);
            double sectionEndPos = splitPoints.get(i + 1);
            var section = Envelope.make(envelopeRange.slice(sectionBeginPos, sectionEndPos));
            var sectionTime = section.getTotalTime();
            var sectionDistance = section.getTotalDistance();
            var sectionRatio = value.distribution.getSectionRatio(
                    sectionTime, baseTime, sectionDistance, baseDistance);
            var targetTime = sectionTime + addedTime * sectionRatio;

            // the imposed begin and end speeds only apply to the first and last section of the range respectively
            var imposedBeginSpeed = sectionBeginPos == rangeBeginPos ? imposedRangeBeginSpeed : NaN;
            var imposedEndSpeed = sectionEndPos == rangeEndPos ? imposedRangeEndSpeed : NaN;

            logger.debug("  computing section n°{}", i + 1);
            var allowanceSection =
                    computeAllowanceSection(section, targetTime, imposedBeginSpeed, imposedEndSpeed);
            assert abs(allowanceSection.getTotalTime() - targetTime) < context.timeStep;
            builder.addEnvelope(allowanceSection);
        }
        return builder.build();
    }

    /** Iteratively apply the allowance on the given section, until the target time is reached */
    private Envelope computeAllowanceSection(Envelope envelopeSection,
                                             double targetTime,
                                             double imposedBeginSpeed,
                                             double imposedEndSpeed) {
        // perform a binary search
        var initialLowBound = computeInitialLowBound(envelopeSection);
        var initialHighBound = computeInitialHighBound(envelopeSection);

        Envelope res = null;
        var search =
                new DoubleBinarySearch(initialLowBound, initialHighBound, targetTime, context.timeStep, true);
        logger.debug("  target time = {}", targetTime);
        for (int i = 1; i < 21 && !search.complete(); i++) {
            var input = search.getInput();
            logger.debug("    starting attempt {}", i);
            res = computeIteration(envelopeSection, input, imposedBeginSpeed, imposedEndSpeed);
            var regionTime = res.getTotalTime();
            logger.debug("    envelope time {}", regionTime);
            search.feedback(regionTime);
        }

        if (!search.complete())
            throw makeError(search);
        return res;
    }

    /** Compute one iteration of the binary search */
    public Envelope computeIteration(Envelope base,
                                     double input) {
        return computeIteration(base, input, NaN, NaN);
    }

    /** Compute one iteration of the binary search, with specified speeds on the edges */
    public Envelope computeIteration(Envelope base,
                                     double input,
                                     double imposedBeginSpeed,
                                     double imposedEndSpeed) {

        // The part of the envelope on which the margin is applied is split in 3:
        // left junction, then core phase, then right junction.
        // The junction parts are needed to transition to keep the total envelope continuous
        // when beginning or end speeds are imposed

        var coreEnvelope = computeCore(base, input);

        // 1) compute the potential junction parts (slowdown or speedup)
        var leftPart = computeLeftJunction(base, coreEnvelope, imposedBeginSpeed);
        var leftPartEndPos = leftPart != null ? leftPart.getEndPos() : base.getBeginPos();
        var coreEnvelopeWithLeft = computeEnvelopeWithLeftJunction(base, coreEnvelope, leftPart);

        var rightPart = computeRightJunction(base, coreEnvelopeWithLeft, imposedEndSpeed);
        var rightPartBeginPos = rightPart != null ? rightPart.getBeginPos() : base.getEndPos();

        // if the junction parts touch or intersect, there is no core phase
        if (rightPartBeginPos <= leftPartEndPos) {
            return intersectLeftRightParts(leftPart, rightPart);
        }

        // 2) stick phases back together
        var builder = new EnvelopeBuilder();
        if (leftPart != null)
            builder.addPart(leftPart);
        builder.addParts(coreEnvelope.slice(leftPartEndPos, rightPartBeginPos));
        if (rightPart != null)
            builder.addPart(rightPart);
        var result = builder.build();

        // 3) check for continuity of the section
        assert result.continuous : "Discontinuity in allowance section";
        return result;
    }

    /** Compute the left junction of the section if a beginning speed is imposed.
     *  This junction can be a slow-down or a speed-up phase,
     *  depending on the imposed begin speed and the target envelope */
    private EnvelopePart computeLeftJunction(Envelope envelopeSection,
                                             Envelope envelopeTarget,
                                             double imposedBeginSpeed) {
        // if there is no imposed begin speed, no junction needs to be computed
        if (Double.isNaN(imposedBeginSpeed))
            return null;

        var constraints = new ArrayList<EnvelopePartConstraint>();
        constraints.add(new PositionConstraint(envelopeSection.getBeginPos(), envelopeSection.getEndPos()));

        var partBuilder = new EnvelopePartBuilder();
        // if the imposed speed is above the target, compute slowdown, else, compute speedup
        if (imposedBeginSpeed > envelopeTarget.getBeginSpeed()) {
            constraints.add(new EnvelopeConstraint(envelopeTarget, FLOOR));
            var constrainedBuilder = new ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    constraints.toArray(new EnvelopePartConstraint[0])
            );
            EnvelopeDeceleration.decelerate(
                    context, envelopeSection.getBeginPos(), imposedBeginSpeed, constrainedBuilder, 1
            );
        } else if (imposedBeginSpeed < envelopeSection.getBeginSpeed()) {
            constraints.add(new EnvelopeConstraint(envelopeTarget, CEILING));
            constraints.add(new EnvelopeConstraint(envelopeSection, CEILING));
            var constrainedBuilder = new ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    constraints.toArray(new EnvelopePartConstraint[0])
            );
            EnvelopeAcceleration.accelerate(
                    context, envelopeSection.getBeginPos(), imposedBeginSpeed, constrainedBuilder, 1
            );
        }
        if (partBuilder.isEmpty())
            return null;
        return partBuilder.build();
    }

    /** Compute the right junction of the section if an end speed is imposed.
     *  This junction can be a speed-up or a slow-down phase,
     *  depending on the imposed end speed and the target envelope */
    private EnvelopePart computeRightJunction(Envelope envelopeSection,
                                              Envelope envelopeTarget,
                                              double imposedEndSpeed) {
        if (Double.isNaN(imposedEndSpeed))
            return null;

        var constraints = new ArrayList<EnvelopePartConstraint>();
        constraints.add(new PositionConstraint(envelopeSection.getBeginPos(), envelopeSection.getEndPos()));

        var partBuilder = new EnvelopePartBuilder();
        // if the imposed speed is above the target compute speed-up, else, compute slow-down
        if (imposedEndSpeed > envelopeTarget.getEndSpeed()) {
            constraints.add(new EnvelopeConstraint(envelopeTarget, FLOOR));
            var constrainedBuilder = new ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    constraints.toArray(new EnvelopePartConstraint[0])
            );
            EnvelopeAcceleration.accelerate(
                    context, envelopeSection.getEndPos(), imposedEndSpeed, constrainedBuilder, -1
            );
        } else if (imposedEndSpeed < envelopeSection.getEndSpeed()) {
            constraints.add(new EnvelopeConstraint(envelopeTarget, CEILING));
            constraints.add(new EnvelopeConstraint(envelopeSection, CEILING));
            var constrainedBuilder = new ConstrainedEnvelopePartBuilder(
                    partBuilder,
                    constraints.toArray(new EnvelopePartConstraint[0])
            );
            EnvelopeDeceleration.decelerate(
                    context, envelopeSection.getEndPos(), imposedEndSpeed, constrainedBuilder, -1
            );
        }
        if (partBuilder.isEmpty())
            return null;
        return partBuilder.build();
    }

    /** Transform leftJunction into an envelope that spans from the beginning to the end of envelopeSection,
     * filling the gap with the core envelope */
    private Envelope computeEnvelopeWithLeftJunction(Envelope envelopeSection,
                                                     Envelope coreEnvelope,
                                                     EnvelopePart leftJunction) {
        var builder = new EnvelopeBuilder();
        if (leftJunction == null)
            return coreEnvelope;
        builder.addPart(leftJunction);
        if (leftJunction.getEndPos() < envelopeSection.getEndPos())
            builder.addParts(coreEnvelope.slice(leftJunction.getEndPos(), Double.POSITIVE_INFINITY));
        return builder.build();
    }

    /** If the left and right part intersect, build an envelope with the intersection */
    private Envelope intersectLeftRightParts(EnvelopePart leftPart, EnvelopePart rightPart) {
        if (rightPart == null || leftPart == null)
            throw AllowanceConvergenceException.tooMuchTime();
        var slicedLeftPart = leftPart.sliceWithSpeeds(
                Double.NEGATIVE_INFINITY, NaN,
                rightPart.getBeginPos(), rightPart.getBeginSpeed()
        );
        return Envelope.make(slicedLeftPart, rightPart);
    }
}
