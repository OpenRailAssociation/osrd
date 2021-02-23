package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.util.graph.EdgeDirection;
import fr.sncf.osrd.util.RangeSequence;

@FunctionalInterface
public interface RangeAttrGetter<ValueT> {
    RangeSequence<ValueT> getAttr(TrackSection edge, EdgeDirection dir);
}
