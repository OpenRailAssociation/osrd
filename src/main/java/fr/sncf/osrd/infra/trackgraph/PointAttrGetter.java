package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.utils.PointSequence;
import fr.sncf.osrd.utils.graph.EdgeDirection;

@FunctionalInterface
public interface PointAttrGetter<ValueT> {
    PointSequence<ValueT> getAttr(TrackSection edge, EdgeDirection dir);
}
