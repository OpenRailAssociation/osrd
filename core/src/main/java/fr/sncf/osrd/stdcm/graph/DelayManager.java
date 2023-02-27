package fr.sncf.osrd.stdcm.graph;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.stdcm.preprocessing.interfaces.RouteAvailabilityInterface;
import java.util.List;
import java.util.NavigableSet;
import java.util.TreeSet;

/** This class contains all the methods used to handle delays
 * (how much we can add, how much we need to add, and such)
 * */
public class DelayManager {

    public final double minScheduleTimeStart;
    public final double maxRunTime;
    private final RouteAvailabilityInterface routeAvailability;
    private final STDCMGraph graph;

    DelayManager(
            double minScheduleTimeStart,
            double maxRunTime,
            RouteAvailabilityInterface routeAvailability,
            STDCMGraph graph
    ) {
        this.minScheduleTimeStart = minScheduleTimeStart;
        this.maxRunTime = maxRunTime;
        this.routeAvailability = routeAvailability;
        this.graph = graph;
    }

    /** Returns one value per "opening" (interval between two unavailable times).
     * Always returns the shortest delay to add to enter this opening. */
    NavigableSet<Double> minimumDelaysPerOpening(
            SignalingRoute route,
            double startTime,
            Envelope envelope,
            double startOffset
    ) {
        var res = new TreeSet<Double>();
        var endOffset = startOffset + envelope.getEndPos();
        var path = STDCMUtils.makeTrainPath(route, startOffset, endOffset);
        double time = startTime;
        while (Double.isFinite(time)) {
            var availability = getScaledAvailability(
                    path,
                    0,
                    path.length(),
                    envelope,
                    time
            );
            if (availability instanceof RouteAvailabilityInterface.Available available) {
                res.add(time - startTime);
                time += available.maximumDelay + 1;
            } else if (availability instanceof RouteAvailabilityInterface.Unavailable unavailable) {
                time += unavailable.duration;
            } else
                throw new RuntimeException("STDCM lookahead isn't supported yet");
        }
        return res;
    }

    /** Returns the start time of the next occupancy for the route */
    double findNextOccupancy(SignalingRoute route, double time, double startOffset, Envelope envelope) {
        var endOffset = startOffset + envelope.getEndPos();
        var path = STDCMUtils.makeTrainPath(route, startOffset, endOffset);
        var availability = getScaledAvailability(
                path,
                0,
                path.length(),
                envelope,
                time
        );
        assert availability.getClass() == RouteAvailabilityInterface.Available.class;
        return ((RouteAvailabilityInterface.Available) availability).timeOfNextConflict;
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
    double findMaximumAddedDelay(SignalingRoute route, double startTime, double startOffset, Envelope envelope) {
        double endOffset = startOffset + envelope.getEndPos();
        var path = STDCMUtils.makeTrainPath(route, startOffset, endOffset);
        var availability = getScaledAvailability(
                path, 0, path.length(), envelope, startTime
        );
        assert availability instanceof RouteAvailabilityInterface.Available;
        return ((RouteAvailabilityInterface.Available) availability).maximumDelay;
    }

    /** Calls `routeAvailability.getAvailability`, on an envelope scaled to account for the standard allowance. */
    private RouteAvailabilityInterface.Availability getScaledAvailability(
            TrainPath path,
            double startOffset,
            double endOffset,
            Envelope envelope,
            double startTime
    ) {
        var speedRatio = graph.getStandardAllowanceSpeedRatio(envelope);
        var scaledEnvelope = LinearAllowance.scaleEnvelope(envelope, speedRatio);
        return routeAvailability.getAvailability(
                path,
                startOffset,
                endOffset,
                scaledEnvelope,
                startTime
        );
    }
}
