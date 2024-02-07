package fr.sncf.osrd.graph

import com.google.common.collect.Sets
import com.google.common.graph.EndpointPair
import com.google.common.graph.ImmutableNetwork
import fr.sncf.osrd.infra.api.Direction
import fr.sncf.osrd.infra.api.tracks.undirected.TrackEdge
import fr.sncf.osrd.infra.api.tracks.undirected.TrackNode
import fr.sncf.osrd.railjson.schema.common.graph.EdgeEndpoint

/** Returns the TrackNode matching the edge endpoint */
fun nodeFromEdgeEndpoint(
    undirectedGraph: ImmutableNetwork<TrackNode, TrackEdge>,
    edge: TrackEdge,
    endpoint: EdgeEndpoint
): TrackNode {
    val nodes = undirectedGraph.incidentNodes(edge)
    return if (endpoint == EdgeEndpoint.BEGIN) nodes.nodeU() else nodes.nodeV()
}

/** Set of edges linked to the (edge, endpoint) */
fun adjacentEdges(
    undirectedGraph: ImmutableNetwork<TrackNode, TrackEdge>,
    edge: TrackEdge,
    endpoint: EdgeEndpoint
): Set<TrackEdge?> {
    val node = nodeFromEdgeEndpoint(undirectedGraph, edge, endpoint)
    return Sets.difference(undirectedGraph.incidentEdges(node), mutableSetOf(edge))
}

/**
 * Returns the nodes shared by the two adjacent edges. It may return two nodes if the two edges form
 * a circle.
 */
fun getCommonNodes(
    undirectedGraph: ImmutableNetwork<TrackNode, TrackEdge>,
    edge1: TrackEdge,
    edge2: TrackEdge
): Collection<TrackNode?> {
    val intersection =
        Sets.intersection(
            endpointPairToSet(undirectedGraph.incidentNodes(edge1)),
            endpointPairToSet(undirectedGraph.incidentNodes(edge2))
        )
    assert(intersection.size == 1 || intersection.size == 2)
    return intersection
}

/** Creates a set from a pair of endpoints */
private fun endpointPairToSet(pair: EndpointPair<TrackNode>): Set<TrackNode> {
    return mutableSetOf(pair.nodeU(), pair.nodeV())
}

/** Direction on the edge that starts at the given node */
fun getDirectionFromEndpoint(
    undirectedGraph: ImmutableNetwork<TrackNode, TrackEdge>,
    edge: TrackEdge,
    node: TrackNode
): Direction {
    val endpoint = endpointOfNode(undirectedGraph, edge, node)
    return endpointFromDirection(endpoint)
}

/** Direction which starts at the given endpoint. BEGIN -> FORWARD, END -> BACKWARD */
private fun endpointFromDirection(endpoint: EdgeEndpoint): Direction {
    return if (endpoint == EdgeEndpoint.BEGIN) Direction.FORWARD else Direction.BACKWARD
}

/** Which endpoint (begin / end) the node is on the edge */
fun endpointOfNode(
    undirectedGraph: ImmutableNetwork<TrackNode, TrackEdge>,
    edge: TrackEdge,
    node: TrackNode
): EdgeEndpoint {
    if (undirectedGraph.incidentNodes(edge).nodeU() === node) return EdgeEndpoint.BEGIN
    assert(undirectedGraph.incidentNodes(edge).nodeV() === node)
    return EdgeEndpoint.END
}
