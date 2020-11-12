package fr.sncf.osrd.infra;

import java.util.List;

public abstract class AbstractNode<E extends AbstractEdge> extends Indexed {
    /**
     * Return the list of all TopoEdge which are reachable from a given TopoEdge
     */
    abstract List<E> getNeighbors(E from);
}
