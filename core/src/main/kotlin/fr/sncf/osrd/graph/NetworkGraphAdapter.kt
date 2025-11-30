package fr.sncf.osrd.graph

import com.google.common.graph.ImmutableNetwork

/** Implements our custom Graph interface using an ImmutableNetwork */
class NetworkGraphAdapter<NodeT : Any, EdgeT : Any, OffsetT>(
    private val g: ImmutableNetwork<NodeT, EdgeT>
) : Graph<NodeT, EdgeT, OffsetT> {
    override fun getEdgeEnd(edge: EdgeT): NodeT {
        return g.incidentNodes(edge).nodeV()
    }

    override fun getAdjacentEdges(node: NodeT): Collection<EdgeT> {
        return g.outEdges(node)
    }
}
