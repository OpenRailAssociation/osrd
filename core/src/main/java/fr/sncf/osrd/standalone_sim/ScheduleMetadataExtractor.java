package fr.sncf.osrd.standalone_sim;

import static java.lang.Math.max;
import static java.lang.Math.min;

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
import fr.sncf.osrd.standalone_sim.result.*;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import fr.sncf.osrd.utils.CurveSimplification;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class ScheduleMetadataExtractor {
    /** Use an already computed envelope to extract various metadata about a trip. */
    public static ResultTrain run(
            Envelope envelope,
            NewTrainPath trainPath,
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
            infraState.moveTrain(position);
            for (var r : Sets.union(route.getConflictingRoutes(), Set.of(route))) {
                addUpdate(
                        routeOccupied,
                        routeFree,
                        infraState.getState(r).summarize().equals(ReservationRouteState.Summary.RESERVED),
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
        for (var routeID : Sets.union(routeFree.keySet(), routeOccupied.keySet())) {
            var occupied = routeOccupied.getOrDefault(routeID, 0.);
            var free = routeFree.getOrDefault(routeID, trainPath.length());

            // Get the points where the route is freed by the head and occupied by the tail
            // TODO: either remove the need for this, or add comments that explain why it's needed
            var route = infra.getReservationRouteMap().get(routeID);
            assert route != null;
            var shift = min(trainLength, trainPath.length());
            var headFree = free - shift;
            var tailOccupied = occupied + shift;

            res.put(routeID, new ResultOccupancyTiming(
                    envelope.interpolateTotalTime(min(occupied, trainPath.length())),
                    envelope.interpolateTotalTime(min(headFree, trainPath.length())),
                    envelope.interpolateTotalTime(min(tailOccupied, trainPath.length())),
                    envelope.interpolateTotalTime(min(free, trainPath.length()))
            ));
        }
        validate(trainPath, res, envelope, trainLength);
        return res;
    }

    /** Validates that the results make sens, checks for obvious errors */
    private static void validate(
            NewTrainPath trainPath,
            HashMap<String, ResultOccupancyTiming> times,
            Envelope envelope,
            double trainLength
    ) {
        for (var first : trainPath.routePath()) {
            for (var second : trainPath.routePath()) {
                var inverted = first.pathOffset() > second.pathOffset();
                var timeFirst = times.get(first.element().getInfraRoute().getID());
                var timeSecond = times.get(second.element().getInfraRoute().getID());
                assertOrdered(timeFirst.timeHeadFree, timeSecond.timeHeadFree, inverted);
                assertOrdered(timeFirst.timeTailFree, timeSecond.timeTailFree, inverted);
                assertOrdered(timeFirst.timeHeadOccupy, timeSecond.timeHeadOccupy, inverted);
                assertOrdered(timeFirst.timeTailOccupy, timeSecond.timeTailOccupy, inverted);
            }
        }
        for (int i = 1; i < trainPath.routePath().size(); i++) {
            var prev = times.get(trainPath.routePath().get(i - 1).element().getInfraRoute().getID());
            var next = times.get(trainPath.routePath().get(i).element().getInfraRoute().getID());
            assert prev.timeHeadFree >= next.timeHeadOccupy;
            assert prev.timeTailFree >= next.timeTailOccupy;
        }

        // Checks that every route in the path is occupied *at least* when the train is present on it
        for (var route : trainPath.routePath()) {
            var beginOccupancy = max(0, route.pathOffset());
            var endOccupancy = min(
                    route.pathOffset() + route.element().getInfraRoute().getLength() + trainLength,
                    trainPath.length()
            );
            var time = times.get(route.element().getInfraRoute().getID());
            assert time != null;
            assert envelope.interpolateTotalTime(beginOccupancy) >= time.timeHeadOccupy;
            assert envelope.interpolateTotalTime(endOccupancy) <= time.timeTailFree;
        }
    }

    /** Checks that the values are either equals, or in the given order */
    static void assertOrdered(double first, double second, boolean inverted) {
        if (first == second)
            return;
        assert inverted == (first > second);
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
            routeFree.put(id, max(position, routeOccupied.getOrDefault(id, 0.)));
        else
            routeOccupied.put(id, min(position, routeOccupied.getOrDefault(id, pathLength)));
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

    /** Debugging utility method: exports the occupancy times to csv */
    @ExcludeFromGeneratedCodeCoverage()
    @SuppressFBWarnings("UPM_UNCALLED_PRIVATE_METHOD")
    private static void exportOccupancyToCSV(NewTrainPath trainPath, HashMap<String, ResultOccupancyTiming> times) {
        try (Writer writer = new BufferedWriter(new OutputStreamWriter(
                new FileOutputStream("times.csv"), StandardCharsets.UTF_8))) {
            writer.write("route,offset,length,head_occupy,tail_occupy,head_free,tail_free\n");
            for (var route : trainPath.routePath()) {
                var id = route.element().getInfraRoute().getID();
                var t = times.get(id);
                writer.write(String.format("%s,%f,%f,%f,%f,%f,%f%n",
                        id,
                        route.pathOffset(),
                        route.element().getInfraRoute().getLength(),
                        t.timeHeadOccupy,
                        t.timeTailOccupy,
                        t.timeHeadFree,
                        t.timeTailFree
                ));
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
