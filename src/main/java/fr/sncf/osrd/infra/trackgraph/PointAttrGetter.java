package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.util.graph.EdgeDirection;
import fr.sncf.osrd.util.PointSequence;

@FunctionalInterface
public interface PointAttrGetter<ValueT> {
    PointSequence<ValueT> getAttr(TrackSection edge, EdgeDirection dir);
}
