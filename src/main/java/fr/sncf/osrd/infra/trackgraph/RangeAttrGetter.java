package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.utils.RangeSequence;
import fr.sncf.osrd.utils.graph.EdgeDirection;

@FunctionalInterface
public interface RangeAttrGetter<ValueT> {
    RangeSequence<ValueT> getAttr(TrackSection edge, EdgeDirection dir);
}
