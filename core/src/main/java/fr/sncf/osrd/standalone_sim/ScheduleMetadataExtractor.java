package fr.sncf.osrd.standalone_sim;

import com.google.common.collect.Sets;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.new_infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.new_infra_state.api.NewTrainPath;
import fr.sncf.osrd.new_infra_state.api.ReservationRouteState;
import fr.sncf.osrd.new_infra_state.implementation.SignalizationEngine;
import fr.sncf.osrd.new_infra_state.implementation.standalone.StandaloneSignalingSimulation;
import fr.sncf.osrd.new_infra_state.implementation.standalone.StandaloneState;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPath;
import fr.sncf.osrd.standalone_sim.result.*;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import fr.sncf.osrd.utils.CurveSimplification;
import java.util.*;

public class ScheduleMetadataExtractor {
    /** Use an already computed envelope to extract various metadata about a trip. */
    public static ResultTrain run(
            Envelope envelope,
            NewTrainPath trainPath,
            RJSTrainPath rjsTrainPath,
            StandaloneTrainSchedule schedule,
            SignalingInfra infra
    ) throws InvalidInfraException {
        assert envelope.continuous;
        // Compute speeds, head and tail positions
        final var trainLength = schedule.rollingStock.length;
        var speeds = new ArrayList<ResultSpeed>();
        var headPositions = new ArrayList<ResultPosition>();
        double time = 0;
        for (var part : envelope) {
            // Add head position points
            for (int i = 0; i < part.pointCount(); i++) {
                var pos = part.getPointPos(i);
                var speed = part.getPointSpeed(i);
                speeds.add(new ResultSpeed(time, speed, pos));
                headPositions.add(ResultPosition.from(time, pos, trainPath));
                if (i < part.stepCount())
                    time += part.getStepTime(i);
            }

            if (part.getEndSpeed() > 0)
                continue;

            // Add stop duration
            for (var stop : schedule.stops) {
                if (stop.duration == 0. || stop.position < part.getEndPos())
                    continue;
                if (stop.position > part.getEndPos())
                    break;
                time += stop.duration;
                headPositions.add(ResultPosition.from(time, part.getEndPos(), trainPath));
            }
        }

        // Simplify data
        speeds = simplifySpeeds(speeds);
        headPositions = simplifyPositions(headPositions);

        // Compute stops
        var stops = new ArrayList<ResultStops>();
        for (var stop : schedule.stops) {
            var stopTime = ResultPosition.interpolateTime(stop.position, headPositions);
            stops.add(new ResultStops(stopTime, stop.position, stop.duration));
        }
        return new ResultTrain(speeds, headPositions, stops,
                makeRouteOccupancy(infra, envelope, trainPath, trainLength));
    }

    /** Generates the ResultOccupancyTiming objects for each route */
    public static Map<String, ResultOccupancyTiming> makeRouteOccupancy(
            SignalingInfra infra,
            Envelope envelope,
            NewTrainPath trainPath,
            double trainLength
    ) {
        // Earliest position at which the route is occupied
        var routeOccupied = new HashMap<String, Double>();
        // Latest position at which the route is freed
        var routeFree = new HashMap<String, Double>();

        var infraState = StandaloneState.from(trainPath, trainLength);

        // Add routes that are directly occupied by the train (handles routes not protected by signals)
        for (var entry : infraState.routeUpdatePositions.entries()) {
            var position = entry.getKey();
            var route = entry.getValue();
            if (position >= trainPath.length())
                continue;
            infraState.moveTrain(position);
            for (var r : Sets.union(route.getConflictingRoutes(), Set.of(route))) {
                addUpdate(
                        routeOccupied,
                        routeFree,
                        infraState.getState(r).summarize().equals(ReservationRouteState.Summary.FREE),
                        r.getID(),
                        position,
                        trainPath.length()
                );
            }
        }

        // Add signal updates: a route is "occupied" when a signal protecting it isn't green
        var signalizationEngine = SignalizationEngine.from(infra, infraState);
        var events = StandaloneSignalingSimulation.runWithoutEnvelope(trainPath, infraState, signalizationEngine);
        for (var e : events) {
            var routes = e.signal().getProtectedRoutes();
            for (var r : routes) {
                addUpdate(
                        routeOccupied,
                        routeFree,
                        e.state().isFree(),
                        r.getID(),
                        e.position(),
                        trainPath.length()
                );
            }
        }

        // Builds the results, converting positions into times
        var res = new HashMap<String, ResultOccupancyTiming>();
        for (var route : Sets.union(routeFree.keySet(), routeOccupied.keySet())) {
            var occupied = routeOccupied.getOrDefault(route, 0.);
            var free = routeFree.getOrDefault(route, trainPath.length());

            // Get the points where the route is freed by the head and occupied by the tail
            // TODO: either remove the need for this, or add comments that explain why it's needed
            var headFree = Math.min(occupied + trainLength, trainPath.length());
            var tailOccupied = Math.max(free - trainLength, 0);

            res.put(route, new ResultOccupancyTiming(
                    envelope.interpolateTotalTime(occupied),
                    envelope.interpolateTotalTime(headFree),
                    envelope.interpolateTotalTime(tailOccupied),
                    envelope.interpolateTotalTime(free)
            ));
        }
        return res;
    }

    /** Adds a route update to the maps */
    private static void addUpdate(
            Map<String, Double> routeOccupied,
            Map<String, Double> routeFree,
            boolean isFree,
            String id,
            double position,
            double pathLength
    ) {
        if (isFree)
            routeFree.put(id, Math.max(position, routeOccupied.getOrDefault(id, 0.)));
        else
            routeOccupied.put(id, Math.min(position, routeOccupied.getOrDefault(id, pathLength)));
    }

    @SuppressFBWarnings("UPM_UNCALLED_PRIVATE_METHOD")
    private static ArrayList<ResultPosition> simplifyPositions(
            ArrayList<ResultPosition> positions) {
        return CurveSimplification.rdp(
                positions,
                5.,
                (point, start, end) -> {
                    if (Math.abs(start.time - end.time) < 0.000001)
                        return Math.abs(point.pathOffset - start.pathOffset);
                    var proj = start.pathOffset + (point.time - start.time)
                            * (end.pathOffset - start.pathOffset) / (end.time - start.time);
                    return Math.abs(point.pathOffset - proj);
                }
        );
    }

    @SuppressFBWarnings("UPM_UNCALLED_PRIVATE_METHOD")
    private static ArrayList<ResultSpeed> simplifySpeeds(ArrayList<ResultSpeed> speeds) {
        return CurveSimplification.rdp(
                speeds,
                0.2,
                (point, start, end) -> {
                    if (Math.abs(start.position - end.position) < 0.000001)
                        return Math.abs(point.speed - start.speed);
                    var proj = start.speed + (point.position - start.position)
                            * (end.speed - start.speed) / (end.position - start.position);
                    return Math.abs(point.speed - proj);
                }
        );
    }
}
