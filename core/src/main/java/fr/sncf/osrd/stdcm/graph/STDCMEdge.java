package fr.sncf.osrd.stdcm.graph;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import java.util.Objects;

public record STDCMEdge(
        // Route considered for this edge
        SignalingRoute route,
        // Envelope of the train going through the route (starts at t=0). Does not account for allowances.
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
        int minuteTimeStart,
        // Speed factor used to account for standard allowance.
        // e.g. if we have a 5% standard allowance, this value is 1/1.05
        double standardAllowanceSpeedFactor
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
        return new STDCMNode(
                getTotalTime() + timeStart(),
                envelope().getEndSpeed(),
                graph.infra.getSignalingRouteGraph().incidentNodes(route()).nodeV(),
                totalDepartureTimeShift(),
                maximumAddedDelayAfter(),
                this
        );
    }

    /** Returns how long it takes to go from the start to the end of the route, accounting standard allowance. */
    public double getTotalTime() {
        return envelope.getTotalTime() / standardAllowanceSpeedFactor;
    }
}
