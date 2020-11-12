package fr.sncf.osrd.infra;

import java.util.List;

public interface AbstractNode<E extends AbstractEdge> {
    /**
     * Return the list of all Edge which are reachable from a given Edge
     */
    List<E> getNeighbors(E from);
}
