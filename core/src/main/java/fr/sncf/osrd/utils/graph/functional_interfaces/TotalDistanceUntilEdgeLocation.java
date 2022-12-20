package fr.sncf.osrd.utils.graph.functional_interfaces;

import fr.sncf.osrd.utils.graph.Pathfinding;

@FunctionalInterface
public interface TotalDistanceUntilEdgeLocation<EdgeT>  {
    double apply(Pathfinding.EdgeLocation<EdgeT> edgeLocation);
}
