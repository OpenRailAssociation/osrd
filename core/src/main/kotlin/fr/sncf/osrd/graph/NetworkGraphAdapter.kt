package fr.sncf.osrd.graph

import com.google.common.graph.ImmutableNetwork

/** Implements our custom Graph interface using an ImmutableNetwork  */
class NetworkGraphAdapter<NodeT, EdgeT>(private val g: ImmutableNetwork<NodeT, EdgeT>) : Graph<NodeT, EdgeT> {
    override fun getEdgeEnd(edge: EdgeT & Any): NodeT {
        return g.incidentNodes(edge).nodeV()
    }

    override fun getAdjacentEdges(node: NodeT & Any): Collection<EdgeT> {
        return g.outEdges(node)
    }
}
