package fr.sncf.osrd.stdcm.graph;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;

/** This class handles the creation of new edges, handling the many optional parameters. */
public class STDCMEdgeBuilder {

    /** STDCM Graph, needed for most operations */
    private final STDCMGraph graph;

    /** Route considered for the new edge(s) */
    private final SignalingRoute route;

    /** Start time of the edge */
    private double startTime = 0;

    /** Start speed, ignored if envelope is specified */
    private double startSpeed = 0;

    /** Start offset on the given route */
    private double startOffset = 0;

    /** Maximum delay we can add on any of the previous edges by shifting the departure time,
     * without causing a conflict */
    private double prevMaximumAddedDelay = 0;

    /** Sum of all the delay that has been added in the previous edges by shifting the departure time */
    private double prevAddedDelay = 0;

    /** Previous node, used to compute the final path */
    private STDCMNode prevNode = null;

    /** Envelope to use on the edge, if unspecified we try to go at maximum allowed speed */
    private Envelope envelope = null;

    /** If set to true, we add the maximum amount of delay allowed by shifting the departure time.
     * Used when computing allowances  */
    private boolean forceMaxDelay = false;

    /** Index of the last waypoint passed by the train */
    private int waypointIndex = 0;

    // region CONSTRUCTORS

    STDCMEdgeBuilder(SignalingRoute route, STDCMGraph graph) {
        this.route = route;
        this.graph = graph;
    }

    static STDCMEdgeBuilder fromNode(STDCMGraph graph, STDCMNode node, SignalingRoute route) {
        var builder = new STDCMEdgeBuilder(route, graph);
        if (node.locationOnRoute() != null) {
            assert route.equals(node.locationOnRoute().edge());
            builder.startOffset = node.locationOnRoute().offset();
        } else
            assert route.getInfraRoute().getEntryDetector().equals(node.detector());
        builder.startTime = node.time();
        builder.startSpeed = node.speed();
        builder.prevMaximumAddedDelay = node.maximumAddedDelay();
        builder.prevAddedDelay = node.totalPrevAddedDelay();
        builder.prevNode = node;
        builder.waypointIndex = node.waypointIndex();
        return builder;
    }

    // endregion CONSTRUCTORS

    // region SETTERS

    /** Sets the start time of the edge */
    public STDCMEdgeBuilder setStartTime(double startTime) {
        this.startTime = startTime;
        return this;
    }

    /** Sets the start speed, ignored if the envelope has been specified */
    public STDCMEdgeBuilder setStartSpeed(double startSpeed) {
        this.startSpeed = startSpeed;
        return this;
    }

    /** Start offset on the given route */
    public STDCMEdgeBuilder setStartOffset(double startOffset) {
        this.startOffset = startOffset;
        return this;
    }

    /** Sets the maximum delay we can add on any of the previous edges by shifting the departure time */
    public STDCMEdgeBuilder setPrevMaximumAddedDelay(double prevMaximumAddedDelay) {
        this.prevMaximumAddedDelay = prevMaximumAddedDelay;
        return this;
    }

    /** Sets the sum of all the delay that has been added in the previous edges by shifting the departure time */
    public STDCMEdgeBuilder setPrevAddedDelay(double prevAddedDelay) {
        this.prevAddedDelay = prevAddedDelay;
        return this;
    }

    /** Sets the previous node, used to compute the final path */
    public STDCMEdgeBuilder setPrevNode(STDCMNode prevNode) {
        this.prevNode = prevNode;
        return this;
    }

    /** Sets the envelope to use on the edge, if unspecified we try to go at maximum allowed speed */
    public STDCMEdgeBuilder setEnvelope(Envelope envelope) {
        this.envelope = envelope;
        return this;
    }

    /** If set to true, we add the maximum amount of delay allowed by shifting the departure time.
     * Used when computing allowances  */
    public STDCMEdgeBuilder setForceMaxDelay(boolean forceMaxDelay) {
        this.forceMaxDelay = forceMaxDelay;
        return this;
    }

    /** Sets the waypoint index on the new edge (i.e. the index of the last waypoint passed by the train) */
    public STDCMEdgeBuilder setWaypointIndex(int waypointIndex) {
        this.waypointIndex = waypointIndex;
        return this;
    }

    // endregion SETTERS

    // region BUILDERS

    /** Creates all edges that can be accessed on the given route, using all the parameters specified. */
    public Collection<STDCMEdge> makeAllEdges() {
        if (envelope == null)
            envelope = STDCMSimulations.simulateRoute(
                    route,
                    startSpeed,
                    startOffset,
                    graph.rollingStock,
                    graph.comfort,
                    graph.timeStep,
                    STDCMUtils.getStopOnRoute(graph, route, startOffset, waypointIndex),
                    graph.tag
            );
        if (envelope == null)
            return List.of();
        var res = new ArrayList<STDCMEdge>();
        Set<Double> delaysPerOpening;
        if (forceMaxDelay)
            delaysPerOpening = findMaxDelay();
        else
            delaysPerOpening = graph.delayManager.minimumDelaysPerOpening(route, startTime, envelope, startOffset);
        for (var delayNeeded : delaysPerOpening) {
            var newEdge = makeSingleEdge(delayNeeded);
            if (newEdge != null)
                res.add(newEdge);
        }
        return res;
    }

    /** Finds the maximum amount of delay that can be added by simply shifting the departure time
     * (no engineering allowance) */
    private Set<Double> findMaxDelay() {
        var allDelays = graph.delayManager.minimumDelaysPerOpening(route, startTime, envelope, startOffset);
        var lastOpeningDelay = allDelays.floor(prevMaximumAddedDelay);
        if (lastOpeningDelay == null)
            return Set.of();
        return Set.of(Math.min(
                prevMaximumAddedDelay,
                lastOpeningDelay + graph.delayManager.findMaximumAddedDelay(
                        route,
                        startTime + lastOpeningDelay,
                        startOffset,
                        envelope
                )
        ));
    }

    /** Creates a single STDCM edge, adding the given amount of delay */
    private STDCMEdge makeSingleEdge(double delayNeeded) {
        if (Double.isInfinite(delayNeeded))
            return null;
        var maximumDelay = Math.min(
                prevMaximumAddedDelay - delayNeeded,
                graph.delayManager.findMaximumAddedDelay(route, startTime + delayNeeded, startOffset, envelope)
        );
        var actualStartTime = startTime + delayNeeded;
        var endAtStop = STDCMUtils.getStopOnRoute(graph, route, startOffset, waypointIndex) != null;
        var res = new STDCMEdge(
                route,
                envelope,
                actualStartTime,
                maximumDelay,
                delayNeeded,
                graph.delayManager.findNextOccupancy(route, startTime + delayNeeded, startOffset, envelope),
                prevAddedDelay + delayNeeded,
                prevNode,
                startOffset,
                (int) (actualStartTime / 60),
                graph.getStandardAllowanceSpeedRatio(envelope),
                waypointIndex,
                endAtStop
        );
        if (res.maximumAddedDelayAfter() < 0)
            res = graph.allowanceManager.tryEngineeringAllowance(res);
        if (res == null)
            return null;
        res = graph.backtrackingManager.backtrack(res);
        if (res == null || graph.delayManager.isRunTimeTooLong(res))
            return null;
        return res;
    }

    /** Creates all the edges in the given settings, then look for one that shares the given time of next occupancy.
     * This is used to identify the "openings" between two occupancies,
     * it is used to ensure we use the same one when re-building edges. */
    STDCMEdge findEdgeSameNextOccupancy(double timeNextOccupancy) {
        var newEdges = makeAllEdges();
        // We look for an edge that uses the same opening, identified by the next occupancy
        for (var newEdge : newEdges) {
            // The time of next occupancy is always copied from the same place, we can use float equality
            if (newEdge.timeNextOccupancy() == timeNextOccupancy)
                return newEdge;
        }
        return null; // No result was found
    }

    // endregion BUILDERS
}
