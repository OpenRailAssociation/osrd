package fr.sncf.osrd.api.stdcm;

import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.CEILING;
import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.FLOOR;

import com.google.common.collect.Multimap;
import com.google.common.primitives.Doubles;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder;
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint;
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.ImpossibleSimulationError;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.envelope_sim_infra.MRSP;
import fr.sncf.osrd.infra.api.reservation.DiDetector;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Graph;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.*;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Set;

/** This is the class that encodes the STDCM problem as a graph on which we can run our pathfinding implementation.
 *
 * </p>
 * The implementation is incomplete for now, as we do not consider that the same location at different time
 * can lead to different results. We only visit each route once.
 * */
@SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
public class STDCMGraph implements Graph<STDCMGraph.Node, STDCMGraph.Edge> {

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

    public record Edge(
            // Route considered for this edge
            SignalingRoute route,
            // Envelope of the train going through the route (starts at t=0)
            Envelope envelope,
            // Time at which the train enters the route
            double timeStart,
            // Maximum delay we can add after this route by delaying the start time without causing conflicts
            double maximumAddedDelayAfter,
            // Delay we needed to add in this route to avoid conflicts (by shifting the departure time)
            double addedDelay,
            // Time of the next occupancy of the route, used for hash / equality test
            double timeNextOccupancy,
            // Total delay we have added by shifting the departure time since the start of the path
            double totalDepartureTimeShift,
            // Node located at the start of this edge, null if this is the first edge
            Node previousNode
    ) {
        @Override
        public boolean equals(Object other) {
            if (other == null || other.getClass() != Edge.class)
                return false;
            var otherEdge = (Edge) other;
            if (!route.getInfraRoute().getID().equals(otherEdge.route.getInfraRoute().getID()))
                return false;

            // We need to consider that the edges aren't equal if the times are different,
            // but if we do it "naively" we end up visiting the same places a near-infinite number of times.
            // We handle it by considering that the edges are different if they are separated by an occupied block.
            // The easiest way to implement this is to compare the time of the next occupancy.
            return timeNextOccupancy == otherEdge.timeNextOccupancy;
        }

        @Override
        public int hashCode() {
            return Objects.hash(
                    route.getInfraRoute().getID(),
                    timeNextOccupancy
            );
        }
    }

    public record Node(
            // Time at the transition of the edge
            double time,
            // Speed at the end of the previous edge
            double speed,
            // Detector that separates the routes, this is the physical location of the node
            DiDetector detector,
            // Sum of all the delays we have added by shifting the departure time
            double totalPrevAddedDelay,
            // Maximum delay we can add by delaying the start time without causing conflicts
            double maximumAddedDelay,
            // Edge that lead to this node
            Edge previousEdge
    ) {}

    @Override
    public Node getEdgeEnd(Edge edge) {
        return new Node(
                edge.envelope.getTotalTime() + edge.timeStart,
                edge.envelope.getEndSpeed(),
                infra.getSignalingRouteGraph().incidentNodes(edge.route).nodeV(),
                edge.totalDepartureTimeShift,
                edge.maximumAddedDelayAfter,
                edge
        );
    }

    @Override
    public Collection<Edge> getAdjacentEdges(Node node) {
        var res = new ArrayList<Edge>();
        var neighbors = infra.getSignalingRouteGraph().outEdges(node.detector);
        for (var neighbor : neighbors) {
            res.addAll(makeEdges(
                    neighbor,
                    node.time,
                    node.speed,
                    0,
                    node.maximumAddedDelay,
                    node.totalPrevAddedDelay,
                    node,
                    null
            ));
        }
        return res;
    }

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

    /** Creates all edges that can be accessed from a given route and start time/speed */
    public Collection<Edge> makeEdges(
            SignalingRoute route,
            double startTime,
            double startSpeed,
            double start,
            double prevMaximumAddedDelay,
            double prevAddedDelay,
            Node node,
            Envelope envelope
    ) {
        if (envelope == null)
            envelope = simulateRoute(route, startSpeed, start, rollingStock, timeStep, getStopsOnRoute(route, start));
        if (envelope == null)
            return List.of();
        var res = new ArrayList<Edge>();
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
            var newEdge = new Edge(
                    route,
                    envelope,
                    startTime + delayNeeded,
                    maximumDelay,
                    delayNeeded,
                    findNextOccupancy(route, startTime + delayNeeded),
                    prevAddedDelay + delayNeeded,
                    node
            );
            newEdge = backtrack(newEdge);
            if (newEdge != null && !isRunTimeTooLong(newEdge))
                res.add(newEdge);
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
    private boolean isRunTimeTooLong(Edge edge) {
        var totalRunTime = edge.timeStart - edge.totalDepartureTimeShift - minScheduleTimeStart;
        // We could use the A* heuristic here, but it would break STDCM on any infra where the
        // coordinates don't match the actual distance (which is the case when generated).
        // Ideally we should add a switch in the railjson format
        return totalRunTime > maxRunTime;
    }

    /** Returns an envelope matching the given route. The envelope time starts when the train enters the route.
     *
     * </p>
     * Note: there are some approximations made here as we only "see" the tracks on the given routes.
     * We are missing slopes and speed limits from earlier in the path.
     * </p>
     * This is public for the purpose of unit tests */
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


    /** Given an edge that needs an envelope change in previous edges to avoid a discontinuity,
     * returns an edge that has no discontinuity.
     * The given edge does not change but the previous ones are new instances with a different envelope.
     * If no backtracking is needed, nothing is done and the edge is returned as it is.
     * If the new edge is invalid, returns null. */
    private Edge backtrack(Edge e) {
        if (e.previousNode == null) {
            assert e.envelope.getBeginSpeed() == 0;
            return e;
        }
        if (e.previousNode.speed == e.envelope.getBeginSpeed())
            return e;
        var previousEdge = e.previousNode.previousEdge;
        var newPreviousEdge = rebuildEdgeBackward(previousEdge, e.envelope.getBeginSpeed());
        if (newPreviousEdge == null)
            return null;

        var newNode = getEdgeEnd(newPreviousEdge);
        var startOffset = e.route.getInfraRoute().getLength() - e.envelope.getEndPos();
        var newEdges = makeEdges(
                e.route,
                newNode.time,
                newNode.speed,
                startOffset,
                newNode.maximumAddedDelay,
                newNode.totalPrevAddedDelay,
                newNode,
                null
        );
        for (var newEdge : newEdges) {
            if (newEdge.timeNextOccupancy == e.timeNextOccupancy)
                return newEdge;
        }
        return null;
    }

    private Edge rebuildEdgeBackward(Edge old, double endSpeed) {
        var edgeStart = old.route.getInfraRoute().getLength() - old.envelope.getEndPos();
        var newEnvelope = simulateBackwards(old.route, endSpeed, edgeStart, old.envelope);
        var prevNode = old.previousNode;
        var newEdges = makeEdges(
                old.route,
                old.timeStart - old.addedDelay,
                Double.NaN,
                edgeStart,
                old.maximumAddedDelayAfter + old.addedDelay,
                prevNode == null ? 0 : prevNode.totalPrevAddedDelay,
                prevNode,
                newEnvelope
        );
        for (var newEdge : newEdges)
            if (newEdge.timeNextOccupancy == old.timeNextOccupancy)
                return newEdge;
        return null;
    }

    /** Simulates a route that already has an envelope, but with a different end speed */
    private Envelope simulateBackwards(
            SignalingRoute route,
            double endSpeed,
            double start,
            Envelope oldEnvelope
    ) {
        var builder = OverlayEnvelopeBuilder.backward(oldEnvelope);
        var context = makeSimContext(route, start, rollingStock, timeStep);
        var partBuilder = new EnvelopePartBuilder();
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
        builder.addPart(partBuilder.build());
        return builder.build();
    }

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
}
