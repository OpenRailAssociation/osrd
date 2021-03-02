package fr.sncf.osrd.utils.graph;

public abstract class BiNEdge<SelfT extends BiNEdge<SelfT>> extends Edge implements IBiNeighborRel<SelfT> {
    protected BiNEdge(int index, int startNode, int endNode, double length) {
        super(index, length);
        this.startNode = startNode;
        this.endNode = endNode;
    }

    public final int startNode;
    public final int endNode;

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

    @Override
    @SuppressWarnings("unchecked")
    public SelfT getEdge(SelfT originEdge, EdgeDirection direction) {
        return (SelfT) this;
    }

    @Override
    public EdgeDirection getDirection(SelfT originEdge, EdgeDirection direction) {
        var intersectionNode = originEdge.getEndNode(direction);
        if (intersectionNode == startNode)
            return EdgeDirection.START_TO_STOP;
        assert intersectionNode == endNode;
        return EdgeDirection.STOP_TO_START;
    }

    @Override
    public boolean isBidirectional() {
        return true;
    }
}
