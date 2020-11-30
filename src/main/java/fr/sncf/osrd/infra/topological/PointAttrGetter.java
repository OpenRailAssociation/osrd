package fr.sncf.osrd.infra.topological;

import fr.sncf.osrd.infra.graph.EdgeDirection;
import fr.sncf.osrd.util.PointSequence;

@FunctionalInterface
public interface PointAttrGetter<ValueT> {
    PointSequence<ValueT> getAttr(TopoEdge edge, EdgeDirection dir);
}
