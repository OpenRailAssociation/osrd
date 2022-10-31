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
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceConvergenceException;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.envelope_sim_infra.MRSP;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
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
                    null,
                    false
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
            Envelope envelope,
            boolean forceMaxDelay
    ) {
        if (envelope == null)
            envelope = simulateRoute(route, startSpeed, start, rollingStock, timeStep, getStopsOnRoute(route, start));
        if (envelope == null)
            return List.of();
        var res = new ArrayList<STDCMEdge>();
        Set<Double> delaysPerOpening;
        if (forceMaxDelay)
            delaysPerOpening = Set.of(Math.min(
                    prevMaximumAddedDelay,
                    findMaximumAddedDelay(route, startTime, envelope))
            );
        else
            delaysPerOpening = minimumDelaysPerOpening(route, startTime, envelope);
        for (var delayNeeded : delaysPerOpening) {
            var newEdge = createSingleEdge(
                    prevMaximumAddedDelay,
                    prevAddedDelay,
                    node,
                    delayNeeded,
                    route,
                    envelope,
                    startTime
            );
            if (newEdge != null)
                res.add(newEdge);
        }
        return res;
    }

    /** Creates an STDCM edge */
    private STDCMEdge createSingleEdge(
            double prevMaximumAddedDelay,
            double prevAddedDelay,
            STDCMNode node,
            Double delayNeeded,
            SignalingRoute route,
            Envelope envelope,
            double startTime
    ) {
        if (delayNeeded.isInfinite())
            return null;
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
                node,
                route.getInfraRoute().getLength() - envelope.getEndPos()
        );
        if (maximumDelay < 0) {
            // We need to make the train go slower
            newEdge = tryEngineeringAllowance(newEdge);
            if (newEdge == null)
                return null;
        }
        newEdge = backtrack(newEdge); // Fixes any speed discontinuity
        if (newEdge == null || isRunTimeTooLong(newEdge))
            return null;
        return newEdge;
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
        return findEdgeSameNextOccupancy(
                e.route(),
                newNode.time(),
                newNode.speed(),
                e.envelopeStartOffset(),
                newNode.maximumAddedDelay(),
                newNode.totalPrevAddedDelay(),
                newNode,
                null,
                e.timeNextOccupancy(),
                false
        );
    }

    /** Recreate the edge, but with a different end speed. Returns null if no result is possible.
     * </p>
     * The new edge will use the same physical path as the old one, but with a different envelope and times.
     * The train speed will be continuous from the start of the path,
     * recursive calls are made when needed (through makeEdges).
     * The start time and any data related to delays will be updated accordingly.
     * */
    private STDCMEdge rebuildEdgeBackward(STDCMEdge old, double endSpeed) {
        var newEnvelope = simulateBackwards(old.route(), endSpeed, old.envelopeStartOffset(), old.envelope());
        var prevNode = old.previousNode();
        return findEdgeSameNextOccupancy(
                old.route(),
                old.timeStart() - old.addedDelay(),
                Double.NaN,
                old.envelopeStartOffset(),
                old.maximumAddedDelayAfter() + old.addedDelay(),
                prevNode == null ? 0 : prevNode.totalPrevAddedDelay(),
                prevNode,
                newEnvelope,
                old.timeNextOccupancy(),
                false
        );
    }

    /** Simulates a route that already has an envelope, but with a different end speed */
    private Envelope simulateBackwards(
            SignalingRoute route,
            double endSpeed,
            double start,
            Envelope oldEnvelope
    ) {
        var context = makeSimContext(List.of(route), start, rollingStock, timeStep);
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
            List<SignalingRoute> routes,
            double offsetFirstRoute,
            RollingStock rollingStock,
            double timeStep
    ) {
        var tracks = new ArrayList<TrackRangeView>();
        for (var route : routes) {
            var routeLength = route.getInfraRoute().getLength();
            tracks.addAll(route.getInfraRoute().getTrackRanges(offsetFirstRoute, routeLength));
            offsetFirstRoute = 0;
        }
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
            var context = makeSimContext(List.of(route), start, rollingStock, timeStep);
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

    /** Calls `makeEdges` with the same parameters, and look for a result with the specified time of next occupancy */
    private STDCMEdge findEdgeSameNextOccupancy(
            SignalingRoute route,
            double startTime,
            double startSpeed,
            double start,
            double prevMaximumAddedDelay,
            double prevAddedDelay,
            STDCMNode node,
            Envelope envelope,
            double timeNextOccupancy,
            boolean forceMaxDelay
    ) {
        var newEdges = makeEdges(
                route,
                startTime,
                startSpeed,
                start,
                prevMaximumAddedDelay,
                prevAddedDelay,
                node,
                envelope,
                forceMaxDelay
        );
        // We look for an edge that uses the same opening, identified by the next occupancy
        for (var newEdge : newEdges)
            if (newEdge.timeNextOccupancy() == timeNextOccupancy)
                return newEdge;
        return null; // No result was found
    }

    // endregion // UTILS

    // region ALLOWANCES

    /** Try to run an engineering allowance on the routes leading to the given edge. Returns null if it failed. */
    public STDCMEdge tryEngineeringAllowance(
            STDCMEdge oldEdge
    ) {
        var neededDelay = -oldEdge.maximumAddedDelayAfter();
        assert neededDelay > 0;
        if (oldEdge.previousNode() == null)
            return null; // The conflict happens on the first route, we can't add delay here
        var affectedEdges = findAffectedEdges(
                oldEdge.previousNode().previousEdge(),
                oldEdge.addedDelay()
        );
        if (affectedEdges.isEmpty())
            return null; // No space to try the allowance
        var context = makeAllowanceContext(affectedEdges);
        var oldEnvelope = STDCMUtils.mergeEnvelopes(affectedEdges);
        var newEnvelope = findAllowance(context, oldEnvelope, neededDelay);
        if (newEnvelope == null)
            return null; // We couldn't find an envelope
        var newPreviousEdge = makeNewEdges(affectedEdges, newEnvelope);
        if (newPreviousEdge == null)
            return null; // The new edges are invalid, conflicts shouldn't happen here but it can be too slow
        var newPreviousNode = getEdgeEnd(newPreviousEdge);
        return findEdgeSameNextOccupancy(
                oldEdge.route(),
                newPreviousNode.time(),
                oldEdge.previousNode().speed(),
                0,
                oldEdge.maximumAddedDelayAfter() + oldEdge.addedDelay(),
                oldEdge.previousNode().totalPrevAddedDelay(),
                newPreviousNode,
                null,
                oldEdge.timeNextOccupancy(),
                false
        );
    }

    /** Re-create the edges in order, following the given envelope. */
    private STDCMEdge makeNewEdges(List<STDCMEdge> edges, Envelope totalEnvelope) {
        double previousEnd = 0;
        STDCMEdge prevEdge = null;
        if (edges.get(0).previousNode() != null)
            prevEdge = edges.get(0).previousNode().previousEdge();
        for (var edge : edges) {
            var end = previousEnd + edge.envelope().getEndPos();
            var node = prevEdge == null ? null : getEdgeEnd(prevEdge);
            var maxAddedDelayAfter = edge.maximumAddedDelayAfter() + edge.addedDelay();
            if (node != null)
                maxAddedDelayAfter = node.maximumAddedDelay();
            prevEdge = findEdgeSameNextOccupancy(
                    edge.route(),
                    node == null ? edge.timeStart() : node.time(),
                    edge.envelope().getBeginSpeed(),
                    edge.envelopeStartOffset(),
                    maxAddedDelayAfter,
                    node == null ? 0 : node.totalPrevAddedDelay(),
                    node,
                    extractEnvelopeSection(totalEnvelope, previousEnd, end),
                    edge.timeNextOccupancy(),
                    true
            );
            if (prevEdge == null)
                return null;
            previousEnd = end;
        }
        assert Math.abs(previousEnd - totalEnvelope.getEndPos()) < 1e-5;
        return prevEdge;
    }

    /** Returns a new envelope with the content of the base envelope from start to end, with 0 as first position */
    private static Envelope extractEnvelopeSection(Envelope base, double start, double end) {
        var parts = base.slice(start, end);
        for (int i = 0; i < parts.length; i++)
            parts[i] = parts[i].copyAndShift(-start);
        return Envelope.make(parts);
    }

    /** Try to apply an allowance on the given envelope to add the given delay */
    private Envelope findAllowance(EnvelopeSimContext context, Envelope oldEnvelope, double neededDelay) {
        neededDelay += context.timeStep; // error margin for the dichotomy
        var ranges = List.of(
                new AllowanceRange(0, oldEnvelope.getEndPos(), new AllowanceValue.FixedTime(neededDelay))
        );
        var allowance = new MarecoAllowance(context, 0, oldEnvelope.getEndPos(), 0, ranges);
        try {
            return allowance.apply(oldEnvelope);
        } catch (AllowanceConvergenceException e) {
            return null;
        }
    }

    /** Creates the EnvelopeSimContext to run an allowance on the given edges */
    private EnvelopeSimContext makeAllowanceContext(List<STDCMEdge> edges) {
        var routes = new ArrayList<SignalingRoute>();
        var firstOffset = edges.get(0).route().getInfraRoute().getLength() - edges.get(0).envelope().getEndPos();
        for (var edge : edges)
            routes.add(edge.route());
        return makeSimContext(routes, firstOffset, rollingStock, timeStep);
    }

    /** Find on which edges to run the allowance */
    private List<STDCMEdge> findAffectedEdges(STDCMEdge edge, double delayNeeded) {
        var res = new ArrayDeque<STDCMEdge>();
        while (true) {
            var endTime = edge.timeStart() + edge.envelope().getTotalTime();
            var maxDelayAddedOnEdge = edge.timeNextOccupancy() - endTime;
            if (delayNeeded > maxDelayAddedOnEdge) {
                // We can't add delay in this route, the allowance range ends here (excluded)
                return new ArrayList<>(res);
            }
            res.addFirst(edge);
            if (edge.previousNode() == null) {
                // We've reached the start of the path, this should only happen because of the max delay parameter
                return new ArrayList<>(res);
            }
            delayNeeded += edge.addedDelay();
            edge = edge.previousNode().previousEdge();
        }
    }

    // endregion // ALLOWANCES

}
