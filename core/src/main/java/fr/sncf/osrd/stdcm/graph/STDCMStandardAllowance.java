package fr.sncf.osrd.stdcm.graph;

import fr.sncf.osrd.envelope_sim.EnvelopeSimPath;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.stdcm.preprocessing.interfaces.RouteAvailabilityInterface;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.TrainStop;
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
            EnvelopeSimPath envelopeSimPath,
            RollingStock rollingStock,
            double timeStep,
            RollingStock.Comfort comfort,
            RouteAvailabilityInterface routeAvailability,
            double departureTime,
            List<TrainStop> stops
    ) {
        if (standardAllowance == null)
            return envelope; // This isn't just an optimization, it avoids float inaccuracies
        var rangeTransitions = initRangeTransitions(stops);
        for (int i = 0; i < 10; i++) {
            var newEnvelope = applyAllowanceWithTransitions(
                    envelope,
                    standardAllowance,
                    envelopeSimPath,
                    rollingStock,
                    timeStep,
                    comfort,
                    rangeTransitions
            );
            var conflictOffset = findConflictOffsets(
                    newEnvelope, routeAvailability, ranges, departureTime);
            if (Double.isNaN(conflictOffset))
                return newEnvelope;
            assert !rangeTransitions.contains(conflictOffset) : "conflict offset is already on a range transition";
            logger.info("Conflict in new envelope at offset {}, splitting mareco ranges", conflictOffset);
            rangeTransitions.add(conflictOffset);
        }
        throw new RuntimeException("Couldn't find an envelope that wouldn't cause a conflict");
    }

    /** Initiates the range transitions with one transition on each stop */
    private static NavigableSet<Double> initRangeTransitions(List<TrainStop> stops) {
        var res = new TreeSet<Double>();
        for (var stop : stops)
            res.add(stop.position);
        return res;
    }

    /** Looks for the first detected conflict that would happen on the given envelope.
     * If a conflict is found, returns its offset.
     * Otherwise, returns NaN. */
    private static double findConflictOffsets(
            Envelope envelope,
            RouteAvailabilityInterface routeAvailability,
            List<Pathfinding.EdgeRange<STDCMEdge>> ranges,
            double departureTime
    ) {
        var path = STDCMUtils.makePathFromRanges(ranges);
        var availability = routeAvailability.getAvailability(
                path,
                0,
                envelope.getEndPos(),
                envelope,
                departureTime
        );
        assert !(availability.getClass() == RouteAvailabilityInterface.NotEnoughLookahead.class);
        if (availability instanceof RouteAvailabilityInterface.Unavailable unavailable)
            return unavailable.firstConflictOffset;
        return Double.NaN;
    }

    /** Applies the allowance to the final envelope, with range transitions at the given offsets */
    private static Envelope applyAllowanceWithTransitions(
            Envelope envelope,
            AllowanceValue standardAllowance,
            EnvelopeSimPath envelopeSimPath,
            RollingStock rollingStock,
            double timeStep,
            RollingStock.Comfort comfort,
            NavigableSet<Double> rangeTransitions
    ) {

        var allowance = new MarecoAllowance(
                0,
                envelope.getEndPos(),
                1,
                makeAllowanceRanges(standardAllowance, envelope.getEndPos(), rangeTransitions)
        );
        return allowance.apply(envelope,
                EnvelopeSimContextBuilder.build(rollingStock, envelopeSimPath, timeStep, comfort));
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
            if (transition == end)
                continue;
            assert transition < end;
            res.add(new AllowanceRange(transition, end, allowance));
            transition = end;
        }
        if (transition < pathLength)
            res.add(new AllowanceRange(transition, pathLength, allowance));
        return res;
    }
}
