package fr.sncf.osrd.utils.graph;

@FunctionalInterface
public interface CostFunction<EdgeT> {
    /**
     * Returns the cost of going from begin to end on some edge
     * @param edge the edge to compute the cost for
     * @param begin the start position on the edge
     * @param end the end position on the edge
     * @return the cost of making the trip
     */
    double evaluate(EdgeT edge, double begin, double end);
}
