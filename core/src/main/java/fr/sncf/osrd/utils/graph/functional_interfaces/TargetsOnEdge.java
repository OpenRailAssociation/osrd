package fr.sncf.osrd.utils.graph.functional_interfaces;

import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.Collection;

/** Functions that takes an edge and returns the offset of any target for the current step on the edge */
@FunctionalInterface
public interface TargetsOnEdge<EdgeT> {
    Collection<Pathfinding.EdgeLocation<EdgeT>> apply(EdgeT edge);
}
