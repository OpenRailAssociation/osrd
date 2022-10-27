package fr.sncf.osrd.utils.graph.functional_interfaces;

import fr.sncf.osrd.utils.graph.Pathfinding;

@FunctionalInterface
public interface EdgeRangeCost<EdgeT> {
    double apply(Pathfinding.EdgeRange<EdgeT> range);
}
