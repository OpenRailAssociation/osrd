package fr.sncf.osrd.utils.graph.functional_interfaces;

import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.Collection;

/** Function that takes an edge and returns a collection of ranges,
 * used to define blocked ranges on an edge */
public interface EdgeToRanges<EdgeT> {
    Collection<Pathfinding.Range> apply(EdgeT edge);
}
