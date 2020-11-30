package fr.sncf.osrd.infra.branching;

import fr.sncf.osrd.infra.graph.EdgeDirection;
import fr.sncf.osrd.util.PointSequence;

@FunctionalInterface
public interface PointAttrGetter<ValueT> {
    PointSequence.Slice<ValueT> getAttr(BranchAttrs.Slice slice, EdgeDirection dir);
}
