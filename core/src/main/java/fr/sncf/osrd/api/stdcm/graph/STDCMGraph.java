package fr.sncf.osrd.api.stdcm.graph;

import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.CEILING;
import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.FLOOR;

import com.google.common.collect.Multimap;
import com.google.common.primitives.Doubles;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.api.stdcm.BacktrackingEnvelopeAttr;
import fr.sncf.osrd.api.stdcm.OccupancyBlock;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder;
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint;
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.ImpossibleSimulationError;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.envelope_sim_infra.MRSP;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Graph;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.*;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Set;

/** This is the class that encodes the STDCM problem as a graph on which we can run our pathfinding implementation. */
@SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
public class STDCMGraph implements Graph<STDCMNode, STDCMEdge> {

    public final SignalingInfra infra;
    public final RollingStock rollingStock;
    public final double timeStep;
    public final double maxRunTime;
    public final double minScheduleTimeStart;
    private final Multimap<SignalingRoute, OccupancyBlock> unavailableTimes;
    private final Set<Pathfinding.EdgeLocation<SignalingRoute>> endLocations;

    /** Constructor */
    public STDCMGraph(
            SignalingInfra infra,
            RollingStock rollingStock,
            double timeStep,
            Multimap<SignalingRoute, OccupancyBlock> unavailableTimes,
            double maxRunTime,
            double minScheduleTimeStart,
            Set<Pathfinding.EdgeLocation<SignalingRoute>> endLocations
    ) {
        this.infra = infra;
        this.rollingStock = rollingStock;
        this.timeStep = timeStep;
        this.unavailableTimes = unavailableTimes;
        this.maxRunTime = maxRunTime;
        this.minScheduleTimeStart = minScheduleTimeStart;
        this.endLocations = endLocations;
    }

    @Override
    public STDCMNode getEdgeEnd(STDCMEdge edge) {
        return new STDCMNode(
                edge.envelope().getTotalTime() + edge.timeStart(),
                edge.envelope().getEndSpeed(),
                infra.getSignalingRouteGraph().incidentNodes(edge.route()).nodeV(),
                edge.totalDepartureTimeShift(),
                edge.maximumAddedDelayAfter(),
                edge
        );
    }

    @Override
    public Collection<STDCMEdge> getAdjacentEdges(STDCMNode node) {
        var res = new ArrayList<STDCMEdge>();
        var neighbors = infra.getSignalingRouteGraph().outEdges(node.detector());
        for (var neighbor : neighbors) {
            res.addAll(makeEdges(
                    neighbor,
                    node.time(),
                    node.speed(),
                    0,
                    node.maximumAddedDelay(),
                    node.totalPrevAddedDelay(),
                    node,
                    null
            ));
        }
        return res;
    }

    /** Creates all edges that can be accessed from a given route and start time/speed.
     * This is public because it is used to initialize the first edges for the pathfinding */
    public Collection<STDCMEdge> makeEdges(
            SignalingRoute route,
            double startTime,
            double startSpeed,
            double start,
            double prevMaximumAddedDelay,
            double prevAddedDelay,
            STDCMNode node,
            Envelope envelope
    ) {
        if (envelope == null)
            envelope = simulateRoute(route, startSpeed, start, rollingStock, timeStep, getStopsOnRoute(route, start));
        if (envelope == null)
            return List.of();
        var res = new ArrayList<STDCMEdge>();
        var delaysPerOpening = minimumDelaysPerOpening(route, startTime, envelope);
        for (var delayNeeded : delaysPerOpening) {
            if (delayNeeded.isInfinite())
                continue;
            if (prevMaximumAddedDelay < delayNeeded)
                continue;
            var maximumDelay = Math.min(
                    prevMaximumAddedDelay - delayNeeded,
                    findMaximumAddedDelay(route, startTime + delayNeeded, envelope)
            );
            var newEdge = new STDCMEdge(
                    route,
                    envelope,
                    startTime + delayNeeded,
                    maximumDelay,
                    delayNeeded,
                    findNextOccupancy(route, startTime + delayNeeded),
                    prevAddedDelay + delayNeeded,
                    node
            );
            newEdge = backtrack(newEdge); // Fixes any speed discontinuity
            if (newEdge != null && !isRunTimeTooLong(newEdge))
                res.add(newEdge);
        }
        return res;
    }

    // region DELAY MANAGEMENT

    /** Returns one value per "opening" (interval between two unavailable times).
     * Always returns the shortest delay to add to enter this opening. */
    private Set<Double> minimumDelaysPerOpening(SignalingRoute route, double startTime, Envelope envelope) {
        var res = new HashSet<Double>();
        res.add(findMinimumAddedDelay(route, startTime, envelope));
        for (var block : unavailableTimes.get(route)) {
            var enterTime = interpolateTime(envelope, route, block.distanceStart(), startTime);
            var diff = block.timeEnd() - enterTime;
            if (diff < 0)
                continue;
            var time = diff + findMinimumAddedDelay(route, startTime + diff, envelope);
            res.add(time);
        }
        return res;
    }

    /** Returns the start time of the next occupancy for the route (does not depend on the envelope) */
    private double findNextOccupancy(SignalingRoute route, double time) {
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
    private boolean isRunTimeTooLong(STDCMEdge edge) {
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
    private double findMaximumAddedDelay(SignalingRoute route, double startTime, Envelope envelope) {
        var minValue = Double.POSITIVE_INFINITY;
        for (var occupancy : unavailableTimes.get(route)) {
            // This loop has a poor complexity, we need to optimize it by the time we handle full timetables
            var exitTime = interpolateTime(envelope, route, occupancy.distanceEnd(), startTime);
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
    private double findMinimumAddedDelay(SignalingRoute route, double startTime, Envelope envelope) {
        double maxValue = 0;
        if (Double.isInfinite(startTime))
            return 0;
        for (var occupancy : unavailableTimes.get(route)) {
            // This loop has a poor complexity, we need to optimize it by the time we handle full timetables
            var enterTime = interpolateTime(envelope, route, occupancy.distanceStart(), startTime);
            var exitTime = interpolateTime(envelope, route, occupancy.distanceEnd(), startTime);
            if (enterTime > occupancy.timeEnd() || exitTime < occupancy.timeStart())
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

    // endregion // DELAY MANAGEMENT

    // region BACKTRACKING

    /** Given an edge that needs an envelope change in previous edges to avoid a discontinuity,
     * returns an edge that has no discontinuity.
     * The given edge does not change but the previous ones are new instances with a different envelope.
     * If no backtracking is needed, nothing is done and the edge is returned as it is.
     * If the new edge is invalid, returns null. */
    private STDCMEdge backtrack(STDCMEdge e) {
        if (e.previousNode() == null) {
            // First edge of the path
            assert e.envelope().getBeginSpeed() == 0;
            return e;
        }
        if (e.previousNode().speed() == e.envelope().getBeginSpeed()) {
            // No need to backtrack any further
            return e;
        }

        // We try to create a new previous edge with the end speed we need
        var previousEdge = e.previousNode().previousEdge();
        var newPreviousEdge = rebuildEdgeBackward(previousEdge, e.envelope().getBeginSpeed());
        if (newPreviousEdge == null)
            return null; // No valid result was found

        // Create the new edge
        var newNode = getEdgeEnd(newPreviousEdge);
        var startOffset = e.route().getInfraRoute().getLength() - e.envelope().getEndPos();
        var newEdges = makeEdges(
                e.route(),
                newNode.time(),
                newNode.speed(),
                startOffset,
                newNode.maximumAddedDelay(),
                newNode.totalPrevAddedDelay(),
                newNode,
                null
        );
        // We look for an edge that uses the same opening, identified by the next occupancy
        for (var newEdge : newEdges) {
            if (newEdge.timeNextOccupancy() == e.timeNextOccupancy())
                return newEdge;
        }
        return null; // No result was found
    }

    /** Recreate the edge, but with a different end speed. Returns null if no result is possible.
     * </p>
     * The new edge will use the same physical path as the old one, but with a different envelope and times.
     * The train speed will be continuous from the start of the path,
     * recursive calls are made when needed (through makeEdges).
     * The start time and any data related to delays will be updated accordingly.
     * */
    private STDCMEdge rebuildEdgeBackward(STDCMEdge old, double endSpeed) {
        var edgeStart = old.route().getInfraRoute().getLength() - old.envelope().getEndPos();
        var newEnvelope = simulateBackwards(old.route(), endSpeed, edgeStart, old.envelope());
        var prevNode = old.previousNode();
        var newEdges = makeEdges(
                old.route(),
                old.timeStart() - old.addedDelay(),
                Double.NaN,
                edgeStart,
                old.maximumAddedDelayAfter() + old.addedDelay(),
                prevNode == null ? 0 : prevNode.totalPrevAddedDelay(),
                prevNode,
                newEnvelope
        );
        // We look for an edge that uses the same opening, identified by the next occupancy
        for (var newEdge : newEdges)
            if (newEdge.timeNextOccupancy() == old.timeNextOccupancy())
                return newEdge;
        return null; // No result was found
    }

    /** Simulates a route that already has an envelope, but with a different end speed */
    private Envelope simulateBackwards(
            SignalingRoute route,
            double endSpeed,
            double start,
            Envelope oldEnvelope
    ) {
        var context = makeSimContext(route, start, rollingStock, timeStep);
        var partBuilder = new EnvelopePartBuilder();
        partBuilder.setAttr(EnvelopeProfile.BRAKING);
        partBuilder.setAttr(new BacktrackingEnvelopeAttr());
        var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                partBuilder,
                new SpeedConstraint(0, FLOOR),
                new EnvelopeConstraint(oldEnvelope, CEILING)
        );
        EnvelopeDeceleration.decelerate(
                context,
                oldEnvelope.getEndPos(),
                endSpeed,
                overlayBuilder,
                -1
        );
        var builder = OverlayEnvelopeBuilder.backward(oldEnvelope);
        builder.addPart(partBuilder.build());
        return builder.build();
    }

    // endregion // BACKTRACKING

    // region UTILS

    /** Create an EnvelopeSimContext instance from the route and extra parameters */
    private static EnvelopeSimContext makeSimContext(
            SignalingRoute route,
            double start,
            RollingStock rollingStock,
            double timeStep
    ) {
        var length = route.getInfraRoute().getLength();
        var tracks = route.getInfraRoute().getTrackRanges(start, length);
        var envelopePath = EnvelopeTrainPath.from(tracks);
        return new EnvelopeSimContext(rollingStock, envelopePath, timeStep);
    }

    /** Returns an envelope matching the given route. The envelope time starts when the train enters the route.
     *
     * </p>
     * Note: there are some approximations made here as we only "see" the tracks on the given routes.
     * We are missing slopes and speed limits from earlier in the path.
     * </p>
     * This is public because it helps when writing unit tests. */
    public static Envelope simulateRoute(
            SignalingRoute route,
            double initialSpeed,
            double start,
            RollingStock rollingStock,
            double timeStep,
            double[] stops
    ) {
        try {
            var context = makeSimContext(route, start, rollingStock, timeStep);
            var mrsp = MRSP.from(
                    route.getInfraRoute().getTrackRanges(start, start + context.path.getLength()),
                    rollingStock,
                    false,
                    Set.of()
            );
            var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, mrsp);
            return MaxEffortEnvelope.from(context, initialSpeed, maxSpeedEnvelope);
        } catch (ImpossibleSimulationError e) {
            // This can happen when the train can't go through this part,
            // for example because of high slopes with a "weak" rolling stock
            return null;
        }
    }

    /** Returns the offset of the stops on the given route, starting at startOffset*/
    private double[] getStopsOnRoute(SignalingRoute route, double startOffset) {
        var res = new ArrayList<Double>();
        for (var endLocation : endLocations) {
            if (endLocation.edge() == route) {
                var offset = endLocation.offset() - startOffset;
                if (offset >= 0)
                    res.add(offset);
            }
        }
        return Doubles.toArray(res);
    }

    /** Returns the time at which the offset on the given route is reached */
    public static double interpolateTime(
            Envelope envelope,
            SignalingRoute route,
            double routeOffset,
            double startTime
    ) {
        var routeLength = route.getInfraRoute().getLength();
        var envelopeStartOffset = routeLength - envelope.getEndPos();
        var envelopeOffset = Math.max(0, routeOffset - envelopeStartOffset);
        assert envelopeOffset <= envelope.getEndPos();
        return startTime + envelope.interpolateTotalTime(envelopeOffset);
    }

    // endregion // UTILS
}
