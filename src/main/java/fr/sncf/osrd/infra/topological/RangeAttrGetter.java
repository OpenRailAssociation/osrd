package fr.sncf.osrd.infra.topological;

import fr.sncf.osrd.infra.graph.EdgeDirection;
import fr.sncf.osrd.util.RangeSequence;

@FunctionalInterface
public interface RangeAttrGetter<ValueT> {
    RangeSequence<ValueT> getAttr(TopoEdge edge, EdgeDirection dir);
}
