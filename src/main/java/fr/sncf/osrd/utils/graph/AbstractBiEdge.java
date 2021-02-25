package fr.sncf.osrd.utils.graph;


public abstract class AbstractBiEdge<
        NodeT extends AbstractNode,
        EdgeT extends AbstractBiEdge<NodeT, EdgeT>
        > extends AbstractEdge {
    public final int startNode;
    public final int endNode;

    protected AbstractBiEdge(int index, int startNode, int endNode, double length) {
        super(index, length);
        this.startNode = startNode;
        this.endNode = endNode;
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
     * Find which direction we're approaching a neighbor edge from
     */
    public EdgeDirection getNeighborDirection(EdgeT neighbor, int node) {
        if (neighbor.startNode == node)
            return EdgeDirection.START_TO_STOP;
        assert neighbor.endNode == node;
        return EdgeDirection.STOP_TO_START;
    }
}
