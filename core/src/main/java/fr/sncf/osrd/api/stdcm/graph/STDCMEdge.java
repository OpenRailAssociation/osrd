package fr.sncf.osrd.api.stdcm.graph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import java.util.Objects;

public record STDCMEdge(
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
        // Time of the next occupancy of the route, used to identify the "opening" used by the edge
        double timeNextOccupancy,
        // Total delay we have added by shifting the departure time since the start of the path
        double totalDepartureTimeShift,
        // Node located at the start of this edge, null if this is the first edge
        STDCMNode previousNode,
        // Offset of the envelope if it doesn't start at the beginning of the edge
        double envelopeStartOffset,
        // Time at which the train enters the route, discretized by only considering the minutes.
        // Used to identify visited edges
        int minuteTimeStart
) {
    @Override
    public boolean equals(Object other) {
        if (other == null || other.getClass() != STDCMEdge.class)
            return false;
        var otherEdge = (STDCMEdge) other;
        if (!route.getInfraRoute().getID().equals(otherEdge.route.getInfraRoute().getID()))
            return false;

        // We need to consider that the edges aren't equal if the times are different,
        // but if we do it "naively" we end up visiting the same places a near-infinite number of times.
        // We handle it by discretizing the start time of the edge: we round the time down to the minute and compare
        // this value.
        return minuteTimeStart == otherEdge.minuteTimeStart;
    }

    @Override
    public int hashCode() {
        return Objects.hash(
                route.getInfraRoute().getID(),
                timeNextOccupancy
        );
    }

    /** Returns the node at the end of this edge */
    STDCMNode getEdgeEnd(STDCMGraph graph) {
        var newEdge = finishBuildingEdge(graph);
        if (newEdge == null)
            return null;
        return new STDCMNode(
                newEdge.envelope().getTotalTime() + newEdge.timeStart(),
                newEdge.envelope().getEndSpeed(),
                graph.infra.getSignalingRouteGraph().incidentNodes(newEdge.route()).nodeV(),
                newEdge.totalDepartureTimeShift(),
                newEdge.maximumAddedDelayAfter(),
                newEdge
        );
    }

    /** Finish building all the expensive computations, such as allowances and backtracking. Returns a new edge,
     * or null if the edge is actually not possible.
     * <p/>
     * This needs to be done before the edge is properly visited,
     * i.e. before accessing the neighbors or the destinations */
    STDCMEdge finishBuildingEdge(STDCMGraph graph) {
        var res = this;
        if (maximumAddedDelayAfter < 0)
            res = graph.allowanceManager.tryEngineeringAllowance(res);
        if (res == null)
            return null;
        res = graph.backtrackingManager.backtrack(res);
        if (res == null || graph.delayManager.isRunTimeTooLong(res))
            return null;
        return res;
    }
}
