package fr.sncf.osrd.utils.graph;

import java.util.List;

/**
 * <p>A pretty special graph, where edges hold all the topological information.
 * Relations are directed, from edge end to edge end.</p>
 * <p>Each edge end stores:</p>
 * <ul>
 *   <li>the list of neighbors reachable from there</li>
 *   <li>the id of the node</li>
 * </ul>

 *  <p>This graph is designed so nodes are easy to replace.</p>
 *
 * @param <NodeT> The types of the nodes
 * @param <EdgeT> The type of the edges
 */
public abstract class AbstractBiGraph<
        NodeT extends AbstractNode,
        EdgeT extends AbstractBiEdge<NodeT, EdgeT>
        > extends AbstractGraph<EdgeT, NodeT> {
    /**
     * Given a side of the edge, return the list of neighbors
     * @param endpoint the end of the edge to consider
     * @return the list of neighbors at this end
     */
    public abstract List<EdgeT> getNeighbors(EdgeT edge, EdgeEndpoint endpoint);

    /**
     * The list of reachable edges at the start of the course over the edge.
     * @param dir the course direction
     * @return the list of reachable edges at the start of the course over the edge
     */
    public List<EdgeT> getStartNeighbors(EdgeT edge, EdgeDirection dir) {
        if (dir == EdgeDirection.START_TO_STOP)
            return getNeighbors(edge, EdgeEndpoint.BEGIN);
        return getNeighbors(edge, EdgeEndpoint.END);
    }

    /**
     * The list of reachable edges at the end of the course over the edge.
     * @param dir the course direction
     * @return the list of reachable edges at the end of the course over the edge
     */
    public List<EdgeT> getEndNeighbors(EdgeT edge, EdgeDirection dir) {
        return getStartNeighbors(edge, dir.opposite());
    }
}



