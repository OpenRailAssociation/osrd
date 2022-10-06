package fr.sncf.osrd.utils.graph;

import java.util.Collection;

/** This is the minimal interface we need to run pathfindings. */
public interface Graph<NodeT, EdgeT> {
    /** Returns the node placed at the end of the given edge */
    NodeT getEdgeEnd(EdgeT edge);

    /** Returns all the edges that start at the given node */
    Collection<EdgeT> getAdjacentEdges(NodeT node);
}
