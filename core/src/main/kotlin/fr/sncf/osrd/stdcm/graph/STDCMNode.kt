package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.infra.api.reservation.DiDetector
import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeLocation

@JvmRecord
data class STDCMNode(
    // Time at the transition of the edge
    val time: Double,
    // Speed at the end of the previous edge
    val speed: Double,
    // Detector that separates the routes, this is the physical location of the node
    val detector: DiDetector?,
    // Sum of all the delays we have added by shifting the departure time
    val totalPrevAddedDelay: Double,
    // Maximum delay we can add by delaying the start time without causing conflicts
    val maximumAddedDelay: Double,
    // Edge that lead to this node
    val previousEdge: STDCMEdge,
    // Index of the last waypoint passed by the train
    val waypointIndex: Int,
    // Position on a route, if this node isn't on the transition between routes (stop)
    val locationOnRoute: EdgeLocation<SignalingRoute>?,
    // When the node is a stop, how long the train remains here
    val stopDuration: Double
)
