package fr.sncf.osrd.utils.graph;

import java.util.Collection;

public interface Graph<NodeT, EdgeT> {
    /** Returns the node placed at the end of the given edge */
    NodeT getEdgeEnd(EdgeT edge);

    /** Returns all the edges adjacent to the given node */
    Collection<EdgeT> getAdjacentEdges(NodeT node);
}
