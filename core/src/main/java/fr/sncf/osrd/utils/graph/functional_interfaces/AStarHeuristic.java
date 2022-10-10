package fr.sncf.osrd.utils.graph.functional_interfaces;

/** This interface defines a function that can be used as a heuristic for an A* pathfinding.
 * It takes an edge and an offset on this edge as inputs, and returns an estimation of the remaining distance. */
@FunctionalInterface
public interface AStarHeuristic<EdgeT> {
    double apply(EdgeT edge, double offset);
}
