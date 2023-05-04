package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeLocation
import java.util.*

@JvmRecord
data class STDCMEdge(
    // Route considered for this edge
    val route: SignalingRoute,
    // Envelope of the train going through the route (starts at t=0). Does not account for allowances.
    val envelope: Envelope,
    // Time at which the train enters the route
    val timeStart: Double,
    // Maximum delay we can add after this route by delaying the start time without causing conflicts
    val maximumAddedDelayAfter: Double,
    // Delay we needed to add in this route to avoid conflicts (by shifting the departure time)
    val addedDelay: Double,
    // Time of the next occupancy of the route, used to identify the "opening" used by the edge
    val timeNextOccupancy: Double,
    // Total delay we have added by shifting the departure time since the start of the path
    val totalDepartureTimeShift: Double,
    // Node located at the start of this edge, null if this is the first edge
    val previousNode: STDCMNode?,
    // Offset of the envelope if it doesn't start at the beginning of the edge
    val envelopeStartOffset: Double,
    // Time at which the train enters the route, discretized by only considering the minutes.
    // Used to identify visited edges
    val minuteTimeStart: Int,
    // Speed factor used to account for standard allowance.
    // e.g. if we have a 5% standard allowance, this value is 1/1.05
    val standardAllowanceSpeedFactor: Double,
    // Index of the last waypoint passed by this train
    val waypointIndex: Int,
    // True if the edge end is a stop
    val endAtStop: Boolean
) {
    override fun equals(other: Any?): Boolean {
        if (other == null || other.javaClass != STDCMEdge::class.java)
            return false
        val otherAsEdge = (other as? STDCMEdge)!!
        if (otherAsEdge.route.infraRoute.id != otherAsEdge.route.infraRoute.id)
            return false

        // We need to consider that the edges aren't equal if the times are different,
        // but if we do it "naively" we end up visiting the same places a near-infinite number of times.
        // We handle it by discretizing the start time of the edge: we round the time down to the minute and compare
        // this value.
        return minuteTimeStart == otherAsEdge.minuteTimeStart
    }

    override fun hashCode(): Int {
        return Objects.hash(
            route.infraRoute.id,
            timeNextOccupancy
        )
    }

    /** Returns the node at the end of this edge  */
    fun getEdgeEnd(graph: STDCMGraph): STDCMNode {
        return if (!endAtStop) {
            // We move on to the next route
            STDCMNode(
                totalTime + timeStart,
                envelope.endSpeed,
                graph.infra.signalingRouteGraph.incidentNodes(route).nodeV(),
                totalDepartureTimeShift,
                maximumAddedDelayAfter,
                this,
                waypointIndex,
                null,
                -1.0
            )
        } else {
            // New edge on the same route, after a stop
            val stopDuration = graph.steps[waypointIndex + 1].duration
            var newWaypointIndex = waypointIndex + 1
            while (newWaypointIndex + 1 < graph.steps.size && !graph.steps[newWaypointIndex + 1].stop) newWaypointIndex++ // Skip waypoints where we don't stop (not handled here)
            STDCMNode(
                totalTime + timeStart + stopDuration,
                envelope.endSpeed,
                null,
                totalDepartureTimeShift,
                maximumAddedDelayAfter,
                this,
                newWaypointIndex,
                EdgeLocation(route, envelopeStartOffset + length),
                stopDuration
            )
        }
    }

    val totalTime: Double
        /** Returns how long it takes to go from the start to the end of the route, accounting standard allowance.  */
        get() = envelope.totalTime / standardAllowanceSpeedFactor
    val length: Double
        /** Returns the length of the edge  */
        get() = envelope.endPos
}
