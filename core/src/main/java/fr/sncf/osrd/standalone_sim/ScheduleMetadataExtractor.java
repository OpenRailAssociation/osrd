package fr.sncf.osrd.standalone_sim;

import static java.lang.Math.*;
import static fr.sncf.osrd.envelope.EnvelopePhysics.getMechanicalEnergyConsumed;

import com.google.common.collect.Sets;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeStopWrapper;
import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.infra.api.signaling.Signal;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.infra_state.api.ReservationRouteState;
import fr.sncf.osrd.infra_state.implementation.SignalizationEngine;
import fr.sncf.osrd.infra_state.implementation.standalone.StandaloneSignalingSimulation;
import fr.sncf.osrd.infra_state.implementation.standalone.StandaloneState;
import fr.sncf.osrd.standalone_sim.result.*;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import fr.sncf.osrd.utils.CurveSimplification;
import java.util.*;
import java.util.List;
import java.util.stream.Collectors;

public class ScheduleMetadataExtractor {
    /** Use an already computed envelope to extract various metadata about a trip. */
    public static ResultTrain run(
            Envelope envelope,
            TrainPath trainPath,
            StandaloneTrainSchedule schedule,
            SignalingInfra infra
    ) {
        assert envelope.continuous;

        // Compute speeds, head and tail positions
        var envelopeWithStops = new EnvelopeStopWrapper(envelope, schedule.stops);
        final var trainLength = schedule.rollingStock.length;
        var speeds = new ArrayList<ResultSpeed>();
        var headPositions = new ArrayList<ResultPosition>();

        for (var point : envelopeWithStops.iterateCurve()) {
            speeds.add(new ResultSpeed(point.time(), point.speed(), point.position()));
            headPositions.add(ResultPosition.from(point.time(), point.position(), trainPath));
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

        // Compute events
        var events = computeEvents(infra, trainPath, trainLength, envelopeWithStops);

        // Compute energy consumed
        var envelopePath = EnvelopeTrainPath.from(trainPath);
        var mechanicalEnergyConsumed =
                getMechanicalEnergyConsumed(envelope, envelopePath, schedule.rollingStock);

        return new ResultTrain(
                speeds,
                headPositions,
                stops,
                makeRouteOccupancy(infra, envelopeWithStops, trainPath, trainLength, events),
                makeSignalUpdates(envelopeWithStops, trainPath, events),
                mechanicalEnergyConsumed
        );
    }

    /** Computes the list of event for the given train path */
    public static List<StandaloneSignalingSimulation.SignalTimedEvent<?>> computeEvents(
            SignalingInfra infra, TrainPath trainPath, double trainLength, EnvelopeTimeInterpolate envelope
    ) {
        var infraState = StandaloneState.from(trainPath, trainLength);
        var signalizationEngine = SignalizationEngine.from(infra, infraState);
        for (var route : trainPath.routePath()) {
            var entrySignal = route.element().getEntrySignal();
            if (entrySignal != null)
                signalizationEngine.setSignalOpen(entrySignal);
        }
        return StandaloneSignalingSimulation.run(trainPath, infraState, signalizationEngine, envelope);
    }

    /** Makes the list of SignalUpdates from the train path and envelope */
    public static Collection<SignalUpdate> makeSignalUpdates(
            EnvelopeTimeInterpolate envelope,
            TrainPath trainPath,
            List<StandaloneSignalingSimulation.SignalTimedEvent<?>> events
    ) {
        var res = new ArrayList<SignalUpdate>();

        // Builds a list of events per signal
        var eventsPerSignal = new IdentityHashMap<Signal<?>, List<StandaloneSignalingSimulation.SignalTimedEvent<?>>>();
        for (var e : events) {
            var list = eventsPerSignal.computeIfAbsent(e.signal(), x -> new ArrayList<>());
            list.add(e);
        }

        for (var entry : eventsPerSignal.entrySet()) {
            var updates = entry.getValue();
            for (int i = 0; i < updates.size(); i++) {
                var update = updates.get(i);
                if (update.state().equals(entry.getKey().getLeastRestrictiveState())) {
                    // The least restrictive state isn't reported,
                    // it's not displayed and assumed to be anywhere not specified
                    continue;
                }
                var timeStart = update.time();
                var timeEnd = envelope.interpolateTotalTime(envelope.getEndPos());
                if (i < updates.size() - 1)
                    timeEnd = updates.get(i + 1).time();
                if (timeStart == timeEnd)
                    continue;
                var routeIDs = entry.getKey().getProtectedRoutes().stream()
                        .map(ReservationRoute::getID)
                        .collect(Collectors.toSet());
                res.add(new SignalUpdate(
                        entry.getKey().getID(),
                        routeIDs,
                        timeStart,
                        timeEnd,
                        update.state().getRGBColor(),
                        false,
                        update.state().getAspectLabel()
                ));
            }
        }

        res.addAll(makeOpenSignalRequirements(trainPath, envelope));

        return res;
    }

    /** The signals must be open from the moment we can see them,
     * this method adds signal updates to display this constraint on occupancy blocks */
    private static Collection<SignalUpdate> makeOpenSignalRequirements(
            TrainPath trainPath,
            EnvelopeTimeInterpolate envelope
    ) {
        var res = new HashSet<SignalUpdate>();
        for (var route : trainPath.routePath()) {
            if (route.pathOffset() < 0)
                continue;
            var entrySignal = route.element().getEntrySignal();
            if (entrySignal == null)
                continue;
            var sightPosition = route.pathOffset() - entrySignal.getSightDistance();
            sightPosition = Math.max(0, sightPosition);
            if (sightPosition > 0) {
                var newUpdate = new SignalUpdate(
                        entrySignal.getID(),
                        Set.of(route.element().getInfraRoute().getID()),
                        envelope.interpolateTotalTime(sightPosition),
                        envelope.interpolateTotalTime(route.pathOffset()),
                        entrySignal.getLeastRestrictiveState().getRGBColor(),
                        false,
                        entrySignal.getLeastRestrictiveState().getAspectLabel()
                );
                res.add(newUpdate);
            }
        }
        return res;
    }


    /** Generates the ResultOccupancyTiming objects for each route */
    public static Map<String, ResultOccupancyTiming> makeRouteOccupancy(
            SignalingInfra infra,
            EnvelopeTimeInterpolate envelope,
            TrainPath trainPath,
            double trainLength,
            List<StandaloneSignalingSimulation.SignalTimedEvent<?>> events
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
                var routeState = infraState.getState(r).summarize();
                var isFree = routeState.equals(ReservationRouteState.Summary.RESERVED)
                        || routeState.equals(ReservationRouteState.Summary.FREE);
                addUpdate(
                        routeOccupied,
                        routeFree,
                        isFree,
                        r.getID(),
                        position,
                        trainPath.length()
                );
            }
        }

        // Add signal updates: a route is "occupied" when a signal protecting it isn't green
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
            var tailOccupied = occupied + shift;
            var headFree = occupied + route.getLength();
            if (routeID.equals(trainPath.routePath().get(0).element().getInfraRoute().getID())) {
                if (trainPath.routePath().size() > 1)
                    headFree = trainPath.routePath().get(1).pathOffset();
                else
                    headFree = trainPath.length();
            }

            res.put(routeID, new ResultOccupancyTiming(
                    envelope.interpolateTotalTimeClamp(occupied),
                    envelope.interpolateTotalTimeClamp(headFree),
                    envelope.interpolateTotalTimeClamp(tailOccupied),
                    envelope.interpolateTotalTimeClamp(free)
            ));
        }
        validate(trainPath, res, envelope, trainLength);
        return res;
    }

    /** Validates that the results make sens, checks for obvious errors */
    private static void validate(
            TrainPath trainPath,
            HashMap<String, ResultOccupancyTiming> times,
            EnvelopeTimeInterpolate envelope,
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
            var beginOccupancy = route.pathOffset();
            var endOccupancy = route.pathOffset() + route.element().getInfraRoute().getLength() + trainLength;
            var time = times.get(route.element().getInfraRoute().getID());
            assert time != null;
            assert envelope.interpolateTotalTimeClamp(beginOccupancy) >= time.timeHeadOccupy;
            assert envelope.interpolateTotalTimeClamp(endOccupancy) <= time.timeTailFree;
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
