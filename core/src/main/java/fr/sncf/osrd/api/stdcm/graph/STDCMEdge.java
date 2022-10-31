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
        // Time of the next occupancy of the route, used for hash / equality test
        double timeNextOccupancy,
        // Total delay we have added by shifting the departure time since the start of the path
        double totalDepartureTimeShift,
        // Node located at the start of this edge, null if this is the first edge
        STDCMNode previousNode,
        // Offset of the envelope if it doesn't start at the beginning of the edge
        double envelopeStartOffset
) {
    @Override
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public boolean equals(Object other) {
        if (other == null || other.getClass() != STDCMEdge.class)
            return false;
        var otherEdge = (STDCMEdge) other;
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
