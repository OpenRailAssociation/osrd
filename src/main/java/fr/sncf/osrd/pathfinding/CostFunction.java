package fr.sncf.osrd.pathfinding;

import fr.sncf.osrd.infra.graph.AbstractEdge;

@FunctionalInterface
public interface CostFunction<EdgeT> {
    /**
     * Returns the cost of going from begin to end on some edge
     * @param edge the edge to compute the cost for
     * @param begin the start position on the edge
     * @param end the end position on the edge
     * @return the cost of making the trip
     */
    double apply(EdgeT edge, double begin, double end);
}
