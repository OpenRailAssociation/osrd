package fr.sncf.osrd.infra;

public abstract class AbstractEdge<N extends AbstractNode> extends Indexed {
    public final N startNode;
    public final N endNode;

    protected AbstractEdge(N startNode, N endNode) {
        this.startNode = startNode;
        this.endNode = endNode;
    }
}
