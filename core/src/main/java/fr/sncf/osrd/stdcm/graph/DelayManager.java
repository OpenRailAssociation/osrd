package fr.sncf.osrd.stdcm.graph;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface;
import fr.sncf.osrd.utils.units.Distance;
import java.util.List;
import java.util.NavigableSet;
import java.util.TreeSet;

/** This class contains all the methods used to handle delays
 * (how much we can add, how much we need to add, and such)
 * */
public class DelayManager {

    public final double minScheduleTimeStart;
    public final double maxRunTime;
    private final BlockAvailabilityInterface blockAvailability;
    private final STDCMGraph graph;

    DelayManager(
            double minScheduleTimeStart,
            double maxRunTime,
            BlockAvailabilityInterface routeAvailability,
            STDCMGraph graph
    ) {
        this.minScheduleTimeStart = minScheduleTimeStart;
        this.maxRunTime = maxRunTime;
        this.blockAvailability = routeAvailability;
        this.graph = graph;
    }

    /** Returns one value per "opening" (interval between two unavailable times).
     * Always returns the shortest delay to add to enter this opening. */
    NavigableSet<Double> minimumDelaysPerOpening(
            int blockId,
            double startTime,
            Envelope envelope,
            long startOffset
    ) {
        // This is the margin used for the binary search, we need to add
        // this time before and after the train to avoid problems caused by the error margin
        double margin = graph.timeStep;

        var res = new TreeSet<Double>();
        var endOffset = startOffset + Distance.fromMeters(envelope.getEndPos());
        double time = startTime;
        while (Double.isFinite(time)) {
            var availability = getScaledAvailability(
                    blockId,
                    startOffset,
                    endOffset,
                    envelope,
                    time
            );
            if (availability instanceof BlockAvailabilityInterface.Available available) {
                if (available.maximumDelay >= margin)
                    res.add(time - startTime);
                time += available.maximumDelay + 1;
            } else if (availability instanceof BlockAvailabilityInterface.Unavailable unavailable) {
                time += unavailable.duration + margin;
            } else
                throw new OSRDError(ErrorType.InvalidSTDCMDelayError);
        }
        return res;
    }

    /** Returns the start time of the next occupancy for the route */
    double findNextOccupancy(int blockId, double time, long startOffset, Envelope envelope) {
        var endOffset = startOffset + Distance.fromMeters(envelope.getEndPos());
        var availability = getScaledAvailability(
                blockId,
                startOffset,
                endOffset,
                envelope,
                time
        );
        assert availability.getClass() == BlockAvailabilityInterface.Available.class;
        return ((BlockAvailabilityInterface.Available) availability).timeOfNextConflict;
    }

    /** Returns true if the total run time at the start of the edge is above the specified threshold */
    boolean isRunTimeTooLong(STDCMEdge edge) {
        var totalRunTime = edge.timeStart() - edge.totalDepartureTimeShift() - minScheduleTimeStart;
        // We could use the A* heuristic here, but it would break STDCM on any infra where the
        // coordinates don't match the actual distance (which is the case when generated).
        // Ideally we should add a switch in the railjson format
        return totalRunTime > maxRunTime;
    }

    /** Returns by how much we can shift this envelope (in time) before causing a conflict.
     * </p>
     * e.g. if the train takes 42s to go through the route, enters the route at t=10s,
     * and we need to leave the route at t=60s, this will return 8s. */
    double findMaximumAddedDelay(int blockId, double startTime, long startOffset, Envelope envelope) {
        long endOffset = startOffset + Distance.fromMeters(envelope.getEndPos());
        var availability = getScaledAvailability(
                blockId, startOffset, endOffset, envelope, startTime
        );
        assert availability instanceof BlockAvailabilityInterface.Available;
        return ((BlockAvailabilityInterface.Available) availability).maximumDelay;
    }

    /** Calls `routeAvailability.getAvailability`, on an envelope scaled to account for the standard allowance. */
    private BlockAvailabilityInterface.Availability getScaledAvailability(
            int blockId,
            long startOffset,
            long endOffset,
            Envelope envelope,
            double startTime
    ) {
        var speedRatio = graph.getStandardAllowanceSpeedRatio(envelope);
        Envelope scaledEnvelope;
        if (envelope.getEndPos() == 0)
            scaledEnvelope = envelope;
        else
            scaledEnvelope = LinearAllowance.scaleEnvelope(envelope, speedRatio);
        return blockAvailability.getAvailability(
                List.of(blockId),
                startOffset,
                endOffset,
                scaledEnvelope,
                startTime
        );
    }
}
