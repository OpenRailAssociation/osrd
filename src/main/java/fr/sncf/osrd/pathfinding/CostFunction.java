package fr.sncf.osrd.pathfinding;

import fr.sncf.osrd.infra.graph.AbstractEdge;

@FunctionalInterface
public interface CostFunction<EdgeT extends AbstractEdge<?>> {
    double apply(EdgeT edge, double begin, double end);
}
