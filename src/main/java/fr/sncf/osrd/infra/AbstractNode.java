package fr.sncf.osrd.infra;

import fr.sncf.osrd.util.Freezable;
import fr.sncf.osrd.util.Indexable;
import java.util.List;

public abstract class AbstractNode<E extends AbstractEdge> implements Indexable, Freezable {
    private int index = -1;

    /**
     * Return the list of all TopoEdge which are reachable from a given TopoEdge
     */
    abstract List<E> getNeighbors(E from);

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
}
