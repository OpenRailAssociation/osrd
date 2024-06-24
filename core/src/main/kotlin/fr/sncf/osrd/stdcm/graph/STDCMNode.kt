package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.utils.units.Offset
import kotlin.math.abs

data class STDCMNode(
    val time: Double, // Time at the transition of the edge
    val speed: Double, // Speed at the end of the previous edge
    val infraExplorer: InfraExplorerWithEnvelope, // Instance used to explore the infra
    val totalPrevAddedDelay:
        Double, // Sum of all the delays we have added by shifting the departure time
    val maximumAddedDelay:
        Double, // Maximum delay we can add by delaying the start time without causing conflicts
    val previousEdge: STDCMEdge, // Edge that lead to this node
    val waypointIndex: Int, // Index of the last waypoint passed by the train
    val locationOnEdge:
        Offset<
            Block
        >?, // Position on a block, if this node isn't on the transition between blocks (stop)
    val stopDuration: Double?, // When the node is a stop, how long the train remains here
    var remainingTimeEstimation: Double =
        0.0, // Estimation of the min time it takes to reach the end from this node
) : Comparable<STDCMNode> {

    /**
     * Defines the estimated better path between 2 nodes, in terms of total run time, then departure
     * time, then number of reached targets. If the result is negative, the current node has a
     * better path, and should be explored first. This method allows us to order the nodes in a
     * priority queue, from the best path to the worst path. We then explore them in that order.
     */
    override fun compareTo(other: STDCMNode): Int {
        val runTimeEstimation = getCurrentRunningTime() + remainingTimeEstimation
        val otherRunTimeEstimation = other.getCurrentRunningTime() + other.remainingTimeEstimation
        // Firstly, minimize the total run time: highest priority node takes the least time to
        // complete the path
        return if (abs(runTimeEstimation - otherRunTimeEstimation) >= 1e-3)
            runTimeEstimation.compareTo(otherRunTimeEstimation)
        // If not, take the train which departs first, as it is the closest to the demanded
        // departure time
        else if (time != other.time) time.compareTo(other.time)
        // In the end, prioritize the highest number of reached targets
        else other.waypointIndex - waypointIndex
    }

    override fun toString(): String {
        // Not everything is included, otherwise it may recurse a lot over edges / nodes
        return String.format(
            "time=%s, speed=%s, lastBlock=%s, waypointIndex=%s",
            time,
            speed,
            infraExplorer.getCurrentBlock(),
            waypointIndex
        )
    }

    fun getCurrentRunningTime(): Double {
        return time - totalPrevAddedDelay
    }
}
