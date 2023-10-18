package fr.sncf.osrd.stdcm.graph;

import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.POSITION_EPSILON;

import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.EnvelopeSimPath;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.standalone_sim.EnvelopeStopWrapper;
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.TrainStop;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.units.Distance;
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
            STDCMGraph graph,
            Envelope envelope,
            List<Pathfinding.EdgeRange<STDCMEdge>> ranges,
            AllowanceValue standardAllowance,
            EnvelopeSimPath envelopeSimPath,
            RollingStock rollingStock,
            double timeStep,
            RollingStock.Comfort comfort,
            BlockAvailabilityInterface blockAvailability,
            double departureTime,
            List<TrainStop> stops
    ) {
        if (standardAllowance == null
                || standardAllowance.getAllowanceTime(envelope.getTotalTime(), envelope.getTotalDistance()) < 1e-5)
            return envelope; // This isn't just an optimization, it avoids float inaccuracies and possible errors
        var rangeTransitions = initRangeTransitions(stops);
        var context = EnvelopeSimContextBuilder.build(rollingStock, envelopeSimPath, timeStep, comfort);
        for (int i = 0; i < 10; i++) {
            var newEnvelope = applyAllowanceWithTransitions(
                    envelope,
                    standardAllowance,
                    rangeTransitions,
                    context
            );
            var conflictOffset = findConflictOffsets(
                    newEnvelope, blockAvailability, ranges, departureTime, stops);
            if (conflictOffset < 0)
                return newEnvelope;
            if (rangeTransitions.contains(conflictOffset))
                break; // Error case, we exit and fallback to the linear envelope
            logger.info("Conflict in new envelope at offset {}, splitting mareco ranges", conflictOffset);
            rangeTransitions.add(conflictOffset);
        }
        logger.info("Failed to compute a mareco standard allowance, fallback to linear allowance");
        return makeFallbackEnvelope(envelope, standardAllowance, context);
    }

    /** Creates an envelope with a linear allowance. To be used in case we fail to compute a mareco envelope */
    private static Envelope makeFallbackEnvelope(
            Envelope envelope,
            AllowanceValue standardAllowance,
            EnvelopeSimContext context
    ) {
        return new LinearAllowance(0, envelope.getEndPos(), 0, List.of(
                new AllowanceRange(0, envelope.getEndPos(), standardAllowance)
        )).apply(envelope, context);
    }

    /** Initiates the range transitions with one transition on each stop */
    private static NavigableSet<Long> initRangeTransitions(List<TrainStop> stops) {
        var res = new TreeSet<Long>();
        for (var stop : stops)
            res.add(Distance.fromMeters(stop.position));
        return res;
    }

    /** Looks for the first detected conflict that would happen on the given envelope.
     * If a conflict is found, returns its offset.
     * Otherwise, returns NaN. */
    private static long findConflictOffsets(
            Envelope envelope,
            BlockAvailabilityInterface blockAvailability,
            List<Pathfinding.EdgeRange<STDCMEdge>> ranges,
            double departureTime,
            List<TrainStop> stops
    ) {
        var envelopeWithStops = new EnvelopeStopWrapper(envelope, stops);
        var startOffset = ranges.get(0).start();
        var endOffset = startOffset + ranges.stream()
                .mapToLong(range -> range.end() - range.start())
                .sum();
        var blocks = ranges.stream()
                .map(x -> x.edge().block())
                .toList();
        assert Math.abs(envelopeWithStops.getEndPos() - Distance.toMeters(endOffset - startOffset)) < POSITION_EPSILON;
        var availability = blockAvailability.getAvailability(
                blocks,
                startOffset,
                endOffset,
                envelopeWithStops,
                departureTime
        );
        assert !(availability.getClass() == BlockAvailabilityInterface.NotEnoughLookahead.class);
        if (availability instanceof BlockAvailabilityInterface.Unavailable unavailable)
            return unavailable.firstConflictOffset;
        return -1;
    }

    /** Applies the allowance to the final envelope, with range transitions at the given offsets */
    private static Envelope applyAllowanceWithTransitions(
            Envelope envelope,
            AllowanceValue standardAllowance,
            NavigableSet<Long> rangeTransitions,
            EnvelopeSimContext context) {

        var allowance = new MarecoAllowance(
                0,
                envelope.getEndPos(),
                0,
                makeAllowanceRanges(standardAllowance, envelope.getEndPos(), rangeTransitions)
        );
        return allowance.apply(envelope, context);
    }

    /** Create the list of `AllowanceRange`, with the given transitions */
    private static List<AllowanceRange> makeAllowanceRanges(
            AllowanceValue allowance,
            double envelopeLength,
            SortedSet<Long> rangeTransitions
    ) {
        double transition = 0;
        var res = new ArrayList<AllowanceRange>();
        for (var endMM : rangeTransitions) {
            var end = Distance.toMeters(endMM);
            if (transition == end)
                continue;
            assert transition < end;
            res.add(new AllowanceRange(transition, end, allowance));
            transition = end;
        }
        if (transition < envelopeLength)
            res.add(new AllowanceRange(transition, envelopeLength, allowance));
        return res;
    }
}
