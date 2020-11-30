package fr.sncf.osrd.infra.branching;

import fr.sncf.osrd.infra.graph.EdgeDirection;
import fr.sncf.osrd.util.RangeSequence;

@FunctionalInterface
public interface RangeAttrGetter<ValueT> {
    RangeSequence.Slice<ValueT> getAttr(BranchAttrs.Slice slice, EdgeDirection dir);
}
