package fr.sncf.osrd.infra.graph;

import fr.sncf.osrd.util.Freezable;
import fr.sncf.osrd.util.Indexable;

public abstract class AbstractEdge<NodeT extends AbstractNode<?>> implements Indexable, Freezable {
    public final NodeT startNode;
    public final NodeT endNode;

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

    protected AbstractEdge(NodeT startNode, NodeT endNode) {
        this.startNode = startNode;
        this.endNode = endNode;
    }
}
