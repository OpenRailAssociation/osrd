package fr.sncf.osrd.stdcm.graph;

import com.google.common.collect.Multimap;
import fr.sncf.osrd.stdcm.OccupancyBlock;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import java.util.HashSet;
import java.util.Set;

/** This class contains all the methods used to handle delays
 * (how much we can add, how much we need to add, and such)
 * */
public class DelayManager {

    public final double minScheduleTimeStart;
    public final double maxRunTime;
    private final Multimap<SignalingRoute, OccupancyBlock> unavailableTimes;
    private final STDCMGraph graph;

    DelayManager(
            double minScheduleTimeStart,
            double maxRunTime,
            Multimap<SignalingRoute, OccupancyBlock> unavailableTimes,
            STDCMGraph graph
    ) {
        this.minScheduleTimeStart = minScheduleTimeStart;
        this.maxRunTime = maxRunTime;
        this.unavailableTimes = unavailableTimes;
        this.graph = graph;
    }

    /** Returns one value per "opening" (interval between two unavailable times).
     * Always returns the shortest delay to add to enter this opening. */
    Set<Double> minimumDelaysPerOpening(SignalingRoute route, double startTime, Envelope envelope) {
        var res = new HashSet<Double>();
        res.add(findMinimumAddedDelay(route, startTime, envelope));
        for (var block : unavailableTimes.get(route)) {
            var enterTime = STDCMSimulations.interpolateTime(
                    envelope,
                    route,
                    block.distanceStart(),
                    startTime,
                    graph.getStandardAllowanceSpeedRatio(envelope, route)
            );
            var diff = block.timeEnd() - enterTime;
            if (diff < 0)
                continue;
            var time = diff + findMinimumAddedDelay(route, startTime + diff, envelope);
            res.add(time);
        }
        return res;
    }

    /** Returns the start time of the next occupancy for the route (does not depend on the envelope) */
    double findNextOccupancy(SignalingRoute route, double time) {
        var earliest = Double.POSITIVE_INFINITY;
        for (var occupancy : unavailableTimes.get(route)) {
            var occupancyTime = occupancy.timeStart();
            if (occupancyTime < time)
                continue;
            earliest = Math.min(earliest, occupancyTime);
        }
        return earliest;
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
    double findMaximumAddedDelay(SignalingRoute route, double startTime, Envelope envelope) {
        var minValue = Double.POSITIVE_INFINITY;
        for (var occupancy : unavailableTimes.get(route)) {
            // This loop has a poor complexity, we need to optimize it by the time we handle full timetables
            var exitTime = STDCMSimulations.interpolateTime(
                    envelope,
                    route,
                    occupancy.distanceEnd(),
                    startTime,
                    graph.getStandardAllowanceSpeedRatio(envelope, route)
            );
            var margin = occupancy.timeStart() - exitTime;
            if (margin < 0) {
                // This occupancy block was before the train passage, we can ignore it
                continue;
            }
            minValue = Math.min(minValue, margin);
        }
        return minValue;
    }

    /** Returns by how much delay we need to add to avoid causing a conflict.
     * </p>
     * e.g. if the whole route is occupied from t=0s to t=60s, and we enter the route at t=42s,
     * this will return 18s. */
    double findMinimumAddedDelay(SignalingRoute route, double startTime, Envelope envelope) {
        double maxValue = 0;
        if (Double.isInfinite(startTime))
            return 0;
        for (var occupancy : unavailableTimes.get(route)) {
            var speedRatio = graph.getStandardAllowanceSpeedRatio(envelope, route);
            // This loop has a poor complexity, we need to optimize it by the time we handle full timetables
            var enterTime = STDCMSimulations.interpolateTime(envelope, route, occupancy.distanceStart(),
                    startTime, speedRatio);
            var exitTime = STDCMSimulations.interpolateTime(envelope, route, occupancy.distanceEnd(),
                    startTime, speedRatio);
            if (enterTime >= occupancy.timeEnd() || exitTime <= occupancy.timeStart())
                continue;
            var diff = occupancy.timeEnd() - enterTime;
            maxValue = Math.max(maxValue, diff);
        }
        if (maxValue == 0 || Double.isInfinite(maxValue))
            return maxValue;

        // We need a recursive call to see if we can fit a curve in the new position,
        // or if we need to shift it further because of a different occupancy block
        return maxValue + findMinimumAddedDelay(route, startTime + maxValue, envelope);
    }

}
