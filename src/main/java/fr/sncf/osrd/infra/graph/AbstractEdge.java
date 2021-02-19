package fr.sncf.osrd.infra.graph;

import fr.sncf.osrd.util.Indexable;

import java.util.List;

public abstract class AbstractEdge<NodeT extends AbstractNode,
        EdgeT extends AbstractEdge<NodeT, EdgeT>> implements Indexable {
    public final int startNode;
    public final int endNode;
    public final double length;

    /**
     * Given a side of the edge, return the list of neighbors
     * @param endpoint the end of the edge to consider
     * @return the list of neighbors at this end
     */
    public abstract List<EdgeT> getNeighbors(EdgeEndpoint endpoint, Graph<NodeT, EdgeT> graph);

    /**
     * The list of reachable edges at the start of the course over the edge.
     * @param dir the course direction
     * @return the list of reachable edges at the start of the course over the edge
     */
    @SuppressWarnings("unused")
    public List<EdgeT> getStartNeighbors(EdgeDirection dir, Graph<NodeT, EdgeT> graph) {
        if (dir == EdgeDirection.START_TO_STOP)
            return getNeighbors(EdgeEndpoint.BEGIN, graph);
        return getNeighbors(EdgeEndpoint.END, graph);
    }

    /**
     * The node at the end of the course over the edge.
     * @param dir the course direction
     * @return The node at the end of the course over the edge.
     */
    public int getEndNode(EdgeDirection dir) {
        if (dir == EdgeDirection.START_TO_STOP)
            return endNode;
        return startNode;
    }

    /**
     * The node at the start of the course over the edge.
     * @param dir the course direction
     * @return The node at the start of the course over the edge.
     */
    @SuppressWarnings("unused")
    public int getStartNode(EdgeDirection dir) {
        if (dir == EdgeDirection.START_TO_STOP)
            return startNode;
        return endNode;
    }

    /**
     * The list of reachable edges at the end of the course over the edge.
     * @param dir the course direction
     * @return the list of reachable edges at the end of the course over the edge
     */
    public List<EdgeT> getEndNeighbors(EdgeDirection dir, Graph<NodeT, EdgeT> graph) {
        if (dir == EdgeDirection.START_TO_STOP)
            return getNeighbors(EdgeEndpoint.END, graph);
        return getNeighbors(EdgeEndpoint.BEGIN, graph);
    }

    private int index = -1;

    @Override
    public void setIndex(int index) {
        assert this.index == -1;
        this.index = index;
    }

    @Override
    public int getIndex() {
        assert index != -1;
        return index;
    }

    protected AbstractEdge(int startNode, int endNode, double length) {
        this.startNode = startNode;
        this.endNode = endNode;
        this.length = length;
    }

    /**
     * Find which direction we're approaching a neighbor edge from
     */
    public EdgeDirection getNeighborDirection(EdgeT neighbor, int node) {
        if (neighbor.startNode == node)
            return EdgeDirection.START_TO_STOP;
        assert neighbor.endNode == node;
        return EdgeDirection.STOP_TO_START;
    }
}
