package fr.sncf.osrd.api.pathfinding.constraints;

import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.graph.functional_interfaces.EdgeToRanges;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;

public class ConstraintCombiner<EdgeT> implements EdgeToRanges<EdgeT> {

    public final List<EdgeToRanges<EdgeT>> functions = new ArrayList<>();

    @Override
    public Collection<Pathfinding.Range> apply(EdgeT edge) {
        var res = new HashSet<Pathfinding.Range>();
        for (var f : functions)
            res.addAll(f.apply(edge));
        return res;
    }
}
