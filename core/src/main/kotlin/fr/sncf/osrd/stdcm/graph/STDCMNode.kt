package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.utils.units.Offset

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
    val stopDuration: Double? // When the node is a stop, how long the train remains here
) {
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
}
