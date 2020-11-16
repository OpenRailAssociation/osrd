package fr.sncf.osrd.infra;

import fr.sncf.osrd.util.Freezable;
import fr.sncf.osrd.util.Indexable;

public abstract class AbstractEdge<N extends AbstractNode> implements Indexable, Freezable {
    public final N startNode;
    public final N endNode;

    private int index = -1;

    @Override
    public void setIndex(int index) {
        assert this.index == -1;
        this.index = index;
    }

    @Override
    public int getIndex() {
        assert index == -1;
        return index;
    }

    protected AbstractEdge(N startNode, N endNode) {
        this.startNode = startNode;
        this.endNode = endNode;
    }
}
