package fr.sncf.osrd.graph

/** This is the minimal interface we need to run pathfindings. */
interface Graph<NodeT, EdgeT, OffsetT> {
    /** Returns the node placed at the end of the given edge */
    fun getEdgeEnd(edge: EdgeT & Any): NodeT

    /** Returns all the edges that start at the given node */
    fun getAdjacentEdges(node: NodeT & Any): Collection<EdgeT>
}
