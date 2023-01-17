package fr.sncf.osrd.api.stdcm.graph;

import com.google.common.collect.Multimap;
import fr.sncf.osrd.api.stdcm.OccupancyBlock;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.PhysicsPath;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.*;

/** We try to apply the standard allowance as one mareco computation over the whole path.
 * If it causes conflicts, we split the mareco ranges so that the passage time at the points of conflict
 * stays the same as the one we expected when exploring the graph. */
public class STDCMStandardAllowance {

    public static final Logger logger = LoggerFactory.getLogger(STDCMStandardAllowance.class);

    /** Applies the allowance to the final envelope */
    static Envelope applyAllowance(
            Envelope envelope,
            List<Pathfinding.EdgeRange<STDCMEdge>> ranges,
            AllowanceValue standardAllowance,
            PhysicsPath physicsPath,
            RollingStock rollingStock,
            double timeStep,
            RollingStock.Comfort comfort,
            Multimap<SignalingRoute, OccupancyBlock> unavailableTimes,
            double departureTime
    ) {
        if (standardAllowance == null)
            return envelope; // This isn't just an optimization, it avoids float inaccuracies
        var rangeTransitions = new TreeSet<Double>();
        for (int i = 0; i < 10; i++) {
            var newEnvelope = applyAllowanceWithTransitions(
                    envelope,
                    standardAllowance,
                    physicsPath,
                    rollingStock,
                    timeStep,
                    comfort,
                    rangeTransitions
            );
            var firstConflictOffset = findFirstConflict(
                    newEnvelope, unavailableTimes, ranges, timeStep, departureTime);
            if (Double.isNaN(firstConflictOffset))
                return newEnvelope;
            logger.info("Conflict in new envelope at offset {}, splitting mareco ranges", firstConflictOffset);
            assert !rangeTransitions.contains(firstConflictOffset);
            rangeTransitions.add(firstConflictOffset);
        }
        throw new RuntimeException("Couldn't find an envelope that wouldn't cause a conflict");
    }

    /** Looks for the first conflict that would happen on the given envelope and unavailable times.
     * If a conflict is founds, returns its offset.
     * Otherwise, returns NaN. */
    private static double findFirstConflict(
            Envelope envelope,
            Multimap<SignalingRoute, OccupancyBlock> unavailableTimes,
            List<Pathfinding.EdgeRange<STDCMEdge>> ranges,
            double timeStep,
            double departureTime
    ) {
        double tolerance = 2 * timeStep;
        double routeStartOffset = 0;
        for (var range : ranges) {
            var blocksOnRoute = unavailableTimes.get(range.edge().route());
            var firstConflict = Double.POSITIVE_INFINITY;
            for (var block : blocksOnRoute) {
                var startOffset = routeStartOffset + block.distanceStart();
                var endOffset = routeStartOffset + block.distanceEnd();
                var enterTime = departureTime + envelope.interpolateTotalTimeClamp(startOffset);
                var exitTime = departureTime + envelope.interpolateTotalTimeClamp(endOffset);
                if (enterTime < block.timeEnd() - tolerance && exitTime > block.timeStart() + tolerance) {
                    // Conflict, but we need to find if we were supposed to pass before or after this block
                    if (range.edge().timeNextOccupancy() == block.timeStart()) {
                        // We were supposed to pass before, and we leave too late: conflict at the end position
                        firstConflict = Double.min(firstConflict, endOffset);
                    } else {
                        // We were supposed to pass after, and we enter too early: conflict at the start position
                        firstConflict = Double.min(firstConflict, startOffset);
                    }
                }
            }
            // We only returns after going through all the blocks for the route, to find the earliest
            if (Double.isFinite(firstConflict))
                return firstConflict;
            routeStartOffset += range.edge().envelope().getEndPos();
        }
        return Double.NaN;
    }

    /** Applies the allowance to the final envelope, with range transitions at the given offsets */
    private static Envelope applyAllowanceWithTransitions(
            Envelope envelope,
            AllowanceValue standardAllowance,
            PhysicsPath physicsPath,
            RollingStock rollingStock,
            double timeStep,
            RollingStock.Comfort comfort,
            TreeSet<Double> rangeTransitions
    ) {
        var allowance = new MarecoAllowance(
                new EnvelopeSimContext(rollingStock, physicsPath, timeStep, comfort),
                0,
                envelope.getEndPos(),
                1,
                makeAllowanceRanges(standardAllowance, envelope.getEndPos(), rangeTransitions)
        );
        return allowance.apply(envelope);
    }

    /** Create the list of `AllowanceRange`, with the given transitions */
    private static List<AllowanceRange> makeAllowanceRanges(
            AllowanceValue allowance,
            double pathLength,
            SortedSet<Double> rangeTransitions
    ) {
        double transition = 0;
        var res = new ArrayList<AllowanceRange>();
        for (var end : rangeTransitions) {
            assert transition < end;
            res.add(new AllowanceRange(transition, end, allowance));
            transition = end;
        }
        assert transition < pathLength;
        res.add(new AllowanceRange(transition, pathLength, allowance));
        return res;
    }
}
