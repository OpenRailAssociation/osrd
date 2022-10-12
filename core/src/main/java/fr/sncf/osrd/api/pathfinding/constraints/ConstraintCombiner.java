package fr.sncf.osrd.api.pathfinding.constraints;

import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.graph.functional_interfaces.EdgeToRanges;
import java.util.Collection;
import java.util.HashSet;

public class ConstraintCombiner implements EdgeToRanges<SignalingRoute> {

    public final Collection<EdgeToRanges<SignalingRoute>> functions;

    public ConstraintCombiner(Collection<EdgeToRanges<SignalingRoute>> functions) {
        this.functions = functions;
    }

    @Override
    public Collection<Pathfinding.Range> apply(SignalingRoute signalingRoute) {
        var res = new HashSet<Pathfinding.Range>();
        for (EdgeToRanges<SignalingRoute> f : functions)
            res.addAll(f.apply(signalingRoute));
        return res;
    }
}
