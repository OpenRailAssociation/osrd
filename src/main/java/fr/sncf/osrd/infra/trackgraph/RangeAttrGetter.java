package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.RangeSequence;

@FunctionalInterface
public interface RangeAttrGetter<ValueT> {
    RangeSequence<ValueT> getAttr(TrackSection edge, EdgeDirection dir);
}
